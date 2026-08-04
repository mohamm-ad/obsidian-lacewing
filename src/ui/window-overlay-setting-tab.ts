import { PluginSettingTab } from "obsidian";
import type { App, SettingDefinitionItem } from "obsidian";
import { opacityPercent } from "../model/settings";
import type WindowOverlayPlugin from "../main";

const DEFAULT_OPACITY_KEY = "defaultOverlayOpacity";

export class WindowOverlaySettingTab extends PluginSettingTab {
	constructor(app: App, private readonly windowOverlay: WindowOverlayPlugin) {
		super(app, windowOverlay);
	}

	override getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: "Manage open windows",
				desc: "Adjust opacity and pinning for the main vault window and each pop-out.",
				render: (setting) => {
					setting.addButton((button) =>
						button.setButtonText("Open manager").setCta().onClick(() => {
							this.windowOverlay.openWindowManager();
						}),
					);
				},
			},
			{
				name: "Default overlay opacity",
				desc: "Opacity used when opening a note as a new overlay.",
				control: {
					type: "slider",
					key: DEFAULT_OPACITY_KEY,
					min: 50,
					max: 100,
					step: 5,
					displayFormat: (value) => `${value}%`,
				},
			},
			{
				name: "Restore every managed overlay",
				desc: "Set every open managed window to 100% opacity and turn off pinning.",
				render: (setting) => {
					setting.addButton((button) =>
						button.setButtonText("Restore all").onClick(() => {
							this.windowOverlay.restoreAllWindows();
						}),
					);
				},
			},
		];
	}

	override getControlValue(key: string): unknown {
		if (key === DEFAULT_OPACITY_KEY) {
			return opacityPercent(
				this.windowOverlay.currentSettings.defaultOverlayOpacity,
			);
		}
		return undefined;
	}

	override setControlValue(key: string, value: unknown): void {
		if (key === DEFAULT_OPACITY_KEY && typeof value === "number") {
			this.windowOverlay.setDefaultOverlayOpacity(value / 100);
		}
	}
}
