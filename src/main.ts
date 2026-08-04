import { Notice, Platform, Plugin } from "obsidian";
import { ElectronWindowAdapter } from "./native/electron-window-adapter";
import { ObsidianWindowSource } from "./windows/obsidian-window-source";
import { WindowRegistry } from "./windows/window-registry";

export default class WindowOverlayPlugin extends Plugin {
	private registry: WindowRegistry | null = null;
	private source: ObsidianWindowSource | null = null;
	private syncQueue: Promise<void> = Promise.resolve();

	override onload(): void {
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
		this.registry = new WindowRegistry(adapter, () => null);
		const scheduleSync = (): void => this.scheduleWindowSync();

		this.registerEvent(this.app.workspace.on("window-open", scheduleSync));
		this.registerEvent(this.app.workspace.on("window-close", scheduleSync));
		this.registerEvent(this.app.workspace.on("layout-change", scheduleSync));
		this.registerEvent(this.app.workspace.on("active-leaf-change", scheduleSync));
		this.app.workspace.onLayoutReady(scheduleSync);

		this.addCommand({
			id: "open-window-manager",
			name: "Open window manager",
			callback: () => {
				new Notice("Window overlay is ready.");
			},
		});
	}

	override onunload(): void {
		this.registry?.dispose();
		this.registry = null;
		this.source = null;
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
}
