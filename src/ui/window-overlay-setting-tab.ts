import { PluginSettingTab } from "obsidian";
import type { App, SettingDefinitionItem } from "obsidian";
import { opacityPercent } from "../model/settings";
import type { SmartFadeSettings } from "../model/settings";
import type WindowOverlayPlugin from "../main";

const DEFAULT_OPACITY_KEY = "defaultOverlayOpacity";
const SMART_FADE_ENABLED_KEY = "smartFadeEnabled";
const SMART_FADE_ACTIVE_OPACITY_KEY = "smartFadeActiveOpacity";
const SMART_FADE_IDLE_OPACITY_KEY = "smartFadeIdleOpacity";
const SMART_FADE_IDLE_DELAY_KEY = "smartFadeIdleDelay";
const SMART_FADE_ON_BLUR_KEY = "smartFadeOnBlur";
const SMART_FADE_ON_KEYBOARD_KEY = "smartFadeOnKeyboard";
const SMART_FADE_ON_POINTER_KEY = "smartFadeOnPointer";

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
				type: "group",
				heading: "Smart fade",
				items: [
					{
						name: "Enable smart fade",
						desc: "Keep the active window readable, then fade it after a short pause.",
						control: {
							type: "toggle",
							key: SMART_FADE_ENABLED_KEY,
						},
					},
					{
						name: "Active opacity",
						desc: "Opacity while typing, clicking, or actively using the window.",
						control: this.smartFadeOpacitySlider(
							SMART_FADE_ACTIVE_OPACITY_KEY,
						),
					},
					{
						name: "Idle opacity",
						desc: "Opacity after the window has been inactive for the idle delay.",
						control: this.smartFadeOpacitySlider(
							SMART_FADE_IDLE_OPACITY_KEY,
						),
					},
					{
						name: "Idle delay",
						desc: "How long to wait after activity before fading the window.",
						control: {
							type: "slider",
							key: SMART_FADE_IDLE_DELAY_KEY,
							min: 250,
							max: 10_000,
							step: 250,
							disabled: () => !this.smartFadeDefaults.enabled,
							displayFormat: (value) => this.formatDelay(value),
						},
					},
					{
						name: "Fade when focus leaves Obsidian",
						desc: "Fade immediately when switching to another app or window.",
						control: this.smartFadeToggle(SMART_FADE_ON_BLUR_KEY),
					},
					{
						name: "Brighten on keyboard activity",
						desc: "Return to active opacity as soon as you type.",
						control: this.smartFadeToggle(SMART_FADE_ON_KEYBOARD_KEY),
					},
					{
						name: "Brighten on pointer activity",
						desc: "Return to active opacity when you click inside the window.",
						control: this.smartFadeToggle(SMART_FADE_ON_POINTER_KEY),
					},
				],
			},
			{
				name: "Restore every managed overlay",
				desc: "Turn off Smart Fade, set every open window to 100% opacity, and turn off pinning.",
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
		const smartFade = this.smartFadeDefaults;
		if (key === DEFAULT_OPACITY_KEY) {
			return opacityPercent(
				this.windowOverlay.currentSettings.defaultOverlayOpacity,
			);
		}
		switch (key) {
			case SMART_FADE_ENABLED_KEY:
				return smartFade.enabled;
			case SMART_FADE_ACTIVE_OPACITY_KEY:
				return opacityPercent(smartFade.activeOpacity);
			case SMART_FADE_IDLE_OPACITY_KEY:
				return opacityPercent(smartFade.idleOpacity);
			case SMART_FADE_IDLE_DELAY_KEY:
				return smartFade.idleDelayMs;
			case SMART_FADE_ON_BLUR_KEY:
				return smartFade.fadeOnBlur;
			case SMART_FADE_ON_KEYBOARD_KEY:
				return smartFade.brightenOnKeyboard;
			case SMART_FADE_ON_POINTER_KEY:
				return smartFade.brightenOnPointer;
		}
		return undefined;
	}

	override setControlValue(key: string, value: unknown): void {
		if (key === DEFAULT_OPACITY_KEY && typeof value === "number") {
			this.windowOverlay.setDefaultOverlayOpacity(value / 100);
			return;
		}

		const patch = this.smartFadePatch(key, value);
		if (patch) {
			this.windowOverlay.setSmartFadeDefaults(patch);
			if (key === SMART_FADE_ENABLED_KEY) {
				this.update();
			}
		}
	}

	private get smartFadeDefaults(): SmartFadeSettings {
		return this.windowOverlay.currentSettings.smartFadeDefaults;
	}

	private smartFadeOpacitySlider(key: string) {
		return {
			type: "slider" as const,
			key,
			min: 50,
			max: 100,
			step: 1,
			disabled: () => !this.smartFadeDefaults.enabled,
			displayFormat: (value: number) => `${value}%`,
		};
	}

	private smartFadeToggle(key: string) {
		return {
			type: "toggle" as const,
			key,
			disabled: () => !this.smartFadeDefaults.enabled,
		};
	}

	private smartFadePatch(
		key: string,
		value: unknown,
	): Partial<SmartFadeSettings> | null {
		if (key === SMART_FADE_ENABLED_KEY && typeof value === "boolean") {
			return { enabled: value };
		}
		if (key === SMART_FADE_ACTIVE_OPACITY_KEY && typeof value === "number") {
			return { activeOpacity: value / 100 };
		}
		if (key === SMART_FADE_IDLE_OPACITY_KEY && typeof value === "number") {
			return { idleOpacity: value / 100 };
		}
		if (key === SMART_FADE_IDLE_DELAY_KEY && typeof value === "number") {
			return { idleDelayMs: value };
		}
		if (key === SMART_FADE_ON_BLUR_KEY && typeof value === "boolean") {
			return { fadeOnBlur: value };
		}
		if (key === SMART_FADE_ON_KEYBOARD_KEY && typeof value === "boolean") {
			return { brightenOnKeyboard: value };
		}
		if (key === SMART_FADE_ON_POINTER_KEY && typeof value === "boolean") {
			return { brightenOnPointer: value };
		}
		return null;
	}

	private formatDelay(milliseconds: number): string {
		const seconds = milliseconds / 1_000;
		return `${seconds.toFixed(Number.isInteger(seconds) ? 0 : 2)} s`;
	}
}
