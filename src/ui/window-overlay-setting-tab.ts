import { PluginSettingTab } from "obsidian";
import type { App, SettingDefinitionItem } from "obsidian";
import {
	isSmartFadeTrigger,
	opacityPercent,
	smartFadeTrigger,
	smartFadeTriggerOverrides,
} from "../model/settings";
import type { SmartFadeSettings } from "../model/settings";
import type WindowOverlayPlugin from "../main";

const DEFAULT_OPACITY_KEY = "defaultOverlayOpacity";
const SMART_FADE_ENABLED_KEY = "smartFadeEnabled";
const SMART_FADE_ACTIVE_OPACITY_KEY = "smartFadeActiveOpacity";
const SMART_FADE_IDLE_OPACITY_KEY = "smartFadeIdleOpacity";
const SMART_FADE_IDLE_DELAY_KEY = "smartFadeIdleDelay";
const SMART_FADE_TRIGGER_KEY = "smartFadeTrigger";
const SMART_FADE_ON_KEYBOARD_KEY = "smartFadeOnKeyboard";
const SMART_FADE_ON_POINTER_KEY = "smartFadeOnPointer";
const SMART_FADE_TRANSITION_DURATION_KEY = "smartFadeTransitionDuration";
const SMART_FADE_REDUCED_MOTION_KEY = "smartFadeReducedMotion";

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
						desc: "Switch between readable active opacity and see-through idle opacity using the selected trigger.",
						control: {
							type: "toggle",
							key: SMART_FADE_ENABLED_KEY,
						},
					},
					{
						name: "Active opacity",
						desc: "Opacity while the window is active. Typing, navigation, clicking, and scrolling can return it here.",
						control: this.smartFadeOpacitySlider(
							SMART_FADE_ACTIVE_OPACITY_KEY,
						),
					},
					{
						name: "Idle opacity",
						desc: "Opacity used when the selected trigger fades the window.",
						control: this.smartFadeOpacitySlider(
							SMART_FADE_IDLE_OPACITY_KEY,
						),
					},
					{
						name: "Transition duration",
						desc: "How quickly opacity changes. Use 0 ms for instant changes; 150–200 ms usually feels natural.",
						control: {
							type: "slider",
							key: SMART_FADE_TRANSITION_DURATION_KEY,
							min: 0,
							max: 500,
							step: 10,
							disabled: () => !this.smartFadeDefaults.enabled,
							displayFormat: (value) =>
								this.formatTransitionDuration(value),
						},
					},
					{
						name: "Respect reduced motion",
						desc: "Use instant opacity changes when Reduce Motion is enabled in macOS Accessibility settings.",
						control: this.smartFadeToggle(
							SMART_FADE_REDUCED_MOTION_KEY,
						),
					},
					{
						name: "Fade trigger",
						desc: "Choose when to fade. Focus loss only keeps a focused window bright for uninterrupted reading.",
						control: {
							type: "dropdown",
							key: SMART_FADE_TRIGGER_KEY,
							options: {
								"inactivity-and-focus-loss": "Inactivity and focus loss",
								"focus-loss-only": "Focus loss only",
								"inactivity-only": "Inactivity only",
							},
							disabled: () => !this.smartFadeDefaults.enabled,
						},
					},
					{
						name: "Idle delay",
						desc: "How long to wait after activity. Used only when the trigger includes inactivity.",
						control: {
							type: "slider",
							key: SMART_FADE_IDLE_DELAY_KEY,
							min: 250,
							max: 10_000,
							step: 250,
							disabled: () => !this.usesInactivity,
							displayFormat: (value) => this.formatDelay(value),
						},
					},
					{
						name: "Brighten on keyboard activity",
						desc: "Typing and navigation keys, including arrows and Page Up or Down, return the window to active opacity.",
						control: this.smartFadeActivityToggle(
							SMART_FADE_ON_KEYBOARD_KEY,
						),
					},
					{
						name: "Brighten on pointer and scroll activity",
						desc: "Clicking or scrolling with a mouse, trackpad, or scrollbar returns the window to active opacity.",
						control: this.smartFadeActivityToggle(
							SMART_FADE_ON_POINTER_KEY,
						),
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
			case SMART_FADE_TRIGGER_KEY:
				return smartFadeTrigger(smartFade);
			case SMART_FADE_ON_KEYBOARD_KEY:
				return smartFade.brightenOnKeyboard;
			case SMART_FADE_ON_POINTER_KEY:
				return smartFade.brightenOnPointer;
			case SMART_FADE_TRANSITION_DURATION_KEY:
				return smartFade.transitionDurationMs;
			case SMART_FADE_REDUCED_MOTION_KEY:
				return smartFade.respectReducedMotion;
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
			if (
				key === SMART_FADE_ENABLED_KEY ||
				key === SMART_FADE_TRIGGER_KEY
			) {
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

	private get usesInactivity(): boolean {
		return (
			this.smartFadeDefaults.enabled &&
			this.smartFadeDefaults.fadeOnInactivity
		);
	}

	private smartFadeActivityToggle(key: string) {
		return {
			type: "toggle" as const,
			key,
			disabled: () => !this.usesInactivity,
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
		if (key === SMART_FADE_TRIGGER_KEY && isSmartFadeTrigger(value)) {
			return smartFadeTriggerOverrides(value);
		}
		if (key === SMART_FADE_ON_KEYBOARD_KEY && typeof value === "boolean") {
			return { brightenOnKeyboard: value };
		}
		if (key === SMART_FADE_ON_POINTER_KEY && typeof value === "boolean") {
			return { brightenOnPointer: value };
		}
		if (
			key === SMART_FADE_TRANSITION_DURATION_KEY &&
			typeof value === "number"
		) {
			return { transitionDurationMs: value };
		}
		if (key === SMART_FADE_REDUCED_MOTION_KEY && typeof value === "boolean") {
			return { respectReducedMotion: value };
		}
		return null;
	}

	private formatDelay(milliseconds: number): string {
		const seconds = milliseconds / 1_000;
		return `${seconds.toFixed(Number.isInteger(seconds) ? 0 : 2)} s`;
	}

	private formatTransitionDuration(milliseconds: number): string {
		return milliseconds === 0 ? "Instant" : `${milliseconds} ms`;
	}
}
