import { Notice, Platform, Plugin } from "obsidian";

export default class WindowOverlayPlugin extends Plugin {
	override onload(): void {
		if (!Platform.isDesktopApp || !Platform.isMacOS) {
			new Notice("Window overlay currently supports Obsidian on macOS.");
			return;
		}

		this.addCommand({
			id: "open-window-manager",
			name: "Open window manager",
			callback: () => {
				new Notice("Window overlay is ready.");
			},
		});
	}
}
