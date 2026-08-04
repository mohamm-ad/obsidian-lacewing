import { Notice, Platform, Plugin } from "obsidian";
import {
	type WindowOverlaySettings,
	type WindowPreference,
} from "./model/settings";
import type { WindowTargetDescriptor } from "./model/window-target";
import { ElectronWindowAdapter } from "./native/electron-window-adapter";
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
	private syncQueue: Promise<void> = Promise.resolve();

	get currentSettings(): WindowOverlaySettings {
		return this.store?.settings ?? this.settings;
	}

	override async onload(): Promise<void> {
		this.store = new PreferenceStore(await this.loadData(), async (settings) => {
			this.settings = settings;
			await this.saveData(settings);
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
		const scheduleSync = (): void => this.scheduleWindowSync();

		this.registerEvent(this.app.workspace.on("window-open", scheduleSync));
		this.registerEvent(this.app.workspace.on("window-close", scheduleSync));
		this.registerEvent(this.app.workspace.on("layout-change", scheduleSync));
		this.registerEvent(this.app.workspace.on("active-leaf-change", scheduleSync));
		this.app.workspace.onLayoutReady(scheduleSync);

		this.addCommand({
			id: "open-window-manager",
			name: "Open window manager",
			callback: () => this.openWindowManager(),
		});
	}

	override onunload(): void {
		this.registry?.dispose();
		this.store?.dispose();
		this.registry = null;
		this.source = null;
		this.store = null;
	}

	setDefaultOverlayOpacity(opacity: number): void {
		this.store?.setDefaultOverlayOpacity(opacity);
	}

	restoreAllWindows(): void {
		this.registry?.restoreAll();
		this.store?.resetAll();
		new Notice("Restored every managed overlay.");
	}

	private scheduleWindowSync(): void {
		this.syncQueue = this.syncQueue
			.then(async () => {
				if (this.registry && this.source) {
					await this.registry.sync(this.source.discover());
				}
			})
			.catch((error: unknown) => {
				console.error("Window overlay could not refresh windows", error);
			});
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
