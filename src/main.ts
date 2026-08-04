import {
	MarkdownView,
	Notice,
	Platform,
	Plugin,
} from "obsidian";
import {
	ActiveWindowCommands,
	type CommandResult,
} from "./commands/active-window-commands";
import {
	type WindowOverlaySettings,
	type WindowPreference,
} from "./model/settings";
import type { WindowTargetDescriptor } from "./model/window-target";
import { ElectronWindowAdapter } from "./native/electron-window-adapter";
import { OverlaySessionTracker } from "./overlay/overlay-session-tracker";
import {
	PreferenceStore,
	defaultWindowPreference,
	emptySettings,
} from "./persistence/preference-store";
import { WindowManagerModal } from "./ui/window-manager-modal";
import { WindowOverlaySettingTab } from "./ui/window-overlay-setting-tab";
import { ObsidianWindowSource } from "./windows/obsidian-window-source";
import { WindowRegistry } from "./windows/window-registry";

export default class WindowOverlayPlugin extends Plugin {
	override settings: WindowOverlaySettings = emptySettings();
	private registry: WindowRegistry | null = null;
	private source: ObsidianWindowSource | null = null;
	private store: PreferenceStore | null = null;
	private activeCommands: ActiveWindowCommands | null = null;
	private readonly overlays = new OverlaySessionTracker();
	private syncQueue: Promise<void> = Promise.resolve();

	get currentSettings(): WindowOverlaySettings {
		return this.store?.settings ?? this.settings;
	}

	override async onload(): Promise<void> {
		this.store = new PreferenceStore(await this.loadData(), async (settings) => {
			this.settings = settings;
			try {
				await this.saveData(settings);
			} catch (error) {
				console.error("Window overlay could not save settings", error);
			}
		});
		this.settings = this.store.settings;
		this.addSettingTab(new WindowOverlaySettingTab(this.app, this));

		if (!Platform.isDesktopApp || !Platform.isMacOS) {
			new Notice("Window overlay currently supports Obsidian on macOS.");
			return;
		}

		const adapter = ElectronWindowAdapter.fromRuntime();
		if (!adapter) {
			new Notice("Window overlay could not access electron window controls.");
			return;
		}

		this.source = new ObsidianWindowSource(this.app);
		this.registry = new WindowRegistry(adapter, (identity) =>
			this.store?.resolve(identity) ?? null,
		);
		this.activeCommands = new ActiveWindowCommands(
			this.registry,
			(descriptor, preference) => {
				this.store?.setPreference(descriptor.persistence, preference);
			},
		);
		const scheduleSync = (): void => {
			void this.scheduleWindowSync();
		};

		this.registerEvent(this.app.workspace.on("window-open", scheduleSync));
		this.registerEvent(
			this.app.workspace.on("window-close", (_workspaceWindow, domWindow) => {
				this.overlays.forgetWindow(domWindow);
				scheduleSync();
			}),
		);
		this.registerEvent(this.app.workspace.on("layout-change", scheduleSync));
		this.registerEvent(this.app.workspace.on("active-leaf-change", scheduleSync));
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				this.store?.migratePath(oldPath, file.path);
				this.overlays.migratePath(oldPath, file.path);
				scheduleSync();
			}),
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				this.store?.removePath(file.path);
				this.overlays.removePath(file.path);
				scheduleSync();
			}),
		);
		this.app.workspace.onLayoutReady(scheduleSync);

		this.addCommand({
			id: "open-window-manager",
			name: "Open window manager",
			callback: () => this.openWindowManager(),
		});
		this.addCommand({
			id: "open-current-note-as-overlay",
			name: "Open current note as overlay",
			callback: () => {
				void this.openCurrentNoteAsOverlay();
			},
		});
		this.addCommand({
			id: "increase-active-window-opacity",
			name: "Increase active-window opacity",
			callback: () =>
				this.reportCommandResult(
					this.activeCommands?.increaseOpacity(activeWindow),
				),
		});
		this.addCommand({
			id: "decrease-active-window-opacity",
			name: "Decrease active-window opacity",
			callback: () =>
				this.reportCommandResult(
					this.activeCommands?.decreaseOpacity(activeWindow),
				),
		});
		this.addCommand({
			id: "toggle-active-window-pinning",
			name: "Toggle active-window pinning",
			callback: () =>
				this.reportCommandResult(
					this.activeCommands?.togglePinning(activeWindow),
				),
		});
		this.addCommand({
			id: "restore-active-window-opacity",
			name: "Restore active window to 100%",
			callback: () =>
				this.reportCommandResult(
					this.activeCommands?.restoreOpacity(activeWindow),
				),
		});
		this.addCommand({
			id: "restore-all-managed-windows",
			name: "Restore every managed overlay",
			callback: () => this.restoreAllWindows(),
		});
	}

	override onunload(): void {
		this.registry?.dispose();
		this.store?.dispose();
		this.overlays.clear();
		this.registry = null;
		this.source = null;
		this.store = null;
		this.activeCommands = null;
	}

	override async onExternalSettingsChange(): Promise<void> {
		if (!this.store) {
			return;
		}
		this.store.replace(await this.loadData());
		this.settings = this.store.settings;
		this.registry?.reapplyPersistentPreferences();
	}

	setDefaultOverlayOpacity(opacity: number): void {
		this.store?.setDefaultOverlayOpacity(opacity);
	}

	restoreAllWindows(): void {
		this.registry?.restoreAll();
		this.store?.resetAll();
		new Notice("Restored every managed overlay.");
	}

	private scheduleWindowSync(): Promise<void> {
		this.syncQueue = this.syncQueue
			.then(async () => {
				if (this.registry && this.source) {
					await this.registry.sync(this.source.discover());
				}
			})
			.catch((error: unknown) => {
				console.error("Window overlay could not refresh windows", error);
			});
		return this.syncQueue;
	}

	private async openCurrentNoteAsOverlay(): Promise<void> {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		const file = view?.file;
		if (!file || !this.registry || !this.store) {
			new Notice("Open a Markdown note before creating an overlay.");
			return;
		}

		const existingWindow = this.overlays.get(file.path);
		if (existingWindow) {
			const existingTarget = this.registry.getTargetForWindow(existingWindow);
			if (existingTarget) {
				this.registry.focus(existingTarget.runtimeId);
			} else {
				existingWindow.focus();
			}
			return;
		}

		try {
			const leaf = this.app.workspace.openPopoutLeaf();
			await leaf.openFile(file);
			const domWindow = leaf.getContainer().win;
			this.overlays.track(file.path, domWindow);
			await this.scheduleWindowSync();
			const descriptor = this.registry.getTargetForWindow(domWindow);
			if (!descriptor) {
				throw new Error("The new pop-out is not available yet.");
			}

			if (
				!this.setWindowPreference(descriptor, {
					opacity: this.store.settings.defaultOverlayOpacity,
					pinned: true,
				})
			) {
				throw new Error("The native overlay controls are unavailable.");
			}
			this.registry.focus(descriptor.runtimeId);
		} catch (error) {
			console.error("Window overlay could not open a note overlay", error);
			new Notice("Window overlay could not open this note in a pop-out.");
		}
	}

	private reportCommandResult(result: CommandResult | undefined): void {
		if (!result || result.status === "no-target") {
			new Notice("Window overlay could not identify the active vault window.");
		} else if (result.status === "unsupported") {
			new Notice("Window overlay controls are unavailable for the active window.");
		}
	}

	private openWindowManager(): void {
		if (!this.registry || !this.store) {
			new Notice("Window overlay controls are unavailable on this system.");
			return;
		}

		new WindowManagerModal(this.app, this.registry, {
			isSaved: (identity) => this.store?.has(identity) ?? false,
			setPreference: (descriptor, preference) =>
				this.setWindowPreference(descriptor, preference),
			reset: (descriptor) => this.resetWindow(descriptor),
		}).open();
	}

	private setWindowPreference(
		descriptor: WindowTargetDescriptor,
		preference: WindowPreference,
	): boolean {
		if (!this.registry?.setPreference(descriptor.runtimeId, preference)) {
			return false;
		}
		this.store?.setPreference(descriptor.persistence, preference);
		return true;
	}

	private resetWindow(descriptor: WindowTargetDescriptor): void {
		this.registry?.setPreference(
			descriptor.runtimeId,
			defaultWindowPreference(),
		);
		this.store?.reset(descriptor.persistence);
	}
}
