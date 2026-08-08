import { PluginSettingTab } from "obsidian";
import type {
	App,
	Hotkey,
	SettingDefinition,
	SettingDefinitionItem,
} from "obsidian";
import { DEFAULT_HOTKEYS } from "../commands/default-hotkeys";
import {
	isSmartFadeTrigger,
	isContrastShieldLevel,
	opacityPercent,
	smartFadeTrigger,
	smartFadeTriggerOverrides,
} from "../model/settings";
import type { SmartFadeSettings } from "../model/settings";
import type WindowOverlayPlugin from "../main";
import {
	appendHotkeyHints,
	descriptionWithHotkeys,
} from "./hotkey-hint";

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
const DEFAULT_CONTRAST_SHIELD_KEY = "defaultContrastShield";

export class WindowOverlaySettingTab extends PluginSettingTab {
	constructor(app: App, private readonly windowOverlay: WindowOverlayPlugin) {
		super(app, windowOverlay);
	}

	override getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				type: "group",
				heading: "Quick actions",
				cls: "window-overlay-settings-group",
				items: [
					this.actionDefinition(
						"Manage open windows",
						"Adjust the main vault window and every pop-out independently.",
						"Open manager",
						DEFAULT_HOTKEYS.openWindowManager,
						() => this.windowOverlay.openWindowManager(),
						true,
					),
					this.actionDefinition(
						"Open current note as an overlay",
						"Duplicate the active Markdown note into a pinned pop-out without moving the original tab.",
						"Open note",
						DEFAULT_HOTKEYS.openCurrentNoteAsOverlay,
						() => {
							void this.windowOverlay.openCurrentNoteAsOverlay();
						},
					),
				],
			},
			{
				type: "group",
				heading: "Overlay defaults",
				cls: "window-overlay-settings-group",
				items: [
					{
						name: "New overlay opacity",
						desc: "Starting opacity for notes opened with the overlay command. Existing windows keep their own setting.",
						aliases: ["Default overlay opacity"],
						control: {
							type: "slider",
							key: DEFAULT_OPACITY_KEY,
							min: 50,
							max: 100,
							step: 5,
							displayFormat: (value) => `${value}%`,
						},
					},
				],
			},
			{
				type: "group",
				heading: "Smart fade",
				cls: "window-overlay-settings-group",
				items: [
					{
						name: "Smart fade",
						desc: "Automatically switch between a readable active state and a more transparent idle state. Turn this on to reveal its controls.",
						control: {
							type: "toggle",
							key: SMART_FADE_ENABLED_KEY,
						},
					},
					{
						name: "Fade trigger",
						desc: "Choose what sends a window to idle. Focus loss only is best when you often read without interacting.",
						visible: () => this.smartFadeDefaults.enabled,
						control: {
							type: "dropdown",
							key: SMART_FADE_TRIGGER_KEY,
							options: {
								"inactivity-and-focus-loss": "Inactivity and focus loss",
								"focus-loss-only": "Focus loss only",
								"inactivity-only": "Inactivity only",
							},
						},
					},
					{
						name: "Active opacity",
						desc: descriptionWithHotkeys(
							"Readable opacity while you use or read the active window.",
							[
								...DEFAULT_HOTKEYS.decreaseActiveWindowOpacity,
								...DEFAULT_HOTKEYS.increaseActiveWindowOpacity,
							],
							"Adjust",
						),
						visible: () => this.smartFadeDefaults.enabled,
						control: this.smartFadeOpacitySlider(
							SMART_FADE_ACTIVE_OPACITY_KEY,
						),
					},
					{
						name: "Idle opacity",
						desc: "See-through opacity used when the selected trigger fades the window.",
						visible: () => this.smartFadeDefaults.enabled,
						control: this.smartFadeOpacitySlider(
							SMART_FADE_IDLE_OPACITY_KEY,
						),
					},
					{
						name: "Idle delay",
						desc: "How long to wait after the last reading or editing activity.",
						visible: () => this.usesInactivity,
						control: {
							type: "slider",
							key: SMART_FADE_IDLE_DELAY_KEY,
							min: 250,
							max: 10_000,
							step: 250,
							displayFormat: (value) => this.formatDelay(value),
						},
					},
					{
						name: "Brighten on keyboard activity",
						desc: "Typing and navigation keys—including arrows and Page Up or Down—reset the idle timer.",
						visible: () => this.usesInactivity,
						control: this.smartFadeActivityToggle(
							SMART_FADE_ON_KEYBOARD_KEY,
						),
					},
					{
						name: "Brighten on pointer and scroll activity",
						desc: "Clicking or scrolling with a mouse, trackpad, or scrollbar resets the idle timer.",
						visible: () => this.usesInactivity,
						control: this.smartFadeActivityToggle(
							SMART_FADE_ON_POINTER_KEY,
						),
					},
					{
						name: "Transition duration",
						desc: "How quickly opacity changes. Use 0 ms for instant changes; 150–200 ms usually feels natural.",
						visible: () => this.smartFadeDefaults.enabled,
						control: {
							type: "slider",
							key: SMART_FADE_TRANSITION_DURATION_KEY,
							min: 0,
							max: 500,
							step: 10,
							displayFormat: (value) =>
								this.formatTransitionDuration(value),
						},
					},
					{
						name: "Respect reduced motion",
						desc: "Use instant opacity changes when Reduce Motion is enabled in macOS Accessibility settings.",
						visible: () => this.smartFadeDefaults.enabled,
						control: this.smartFadeToggle(
							SMART_FADE_REDUCED_MOTION_KEY,
						),
					},
				],
			},
			{
				type: "group",
				heading: "Readability",
				cls: "window-overlay-settings-group",
				items: [
					{
						name: "Contrast shield",
						desc: "Add a theme-aware backing surface behind Markdown content to reduce distraction from what is behind the window. This does not change window opacity or your theme.",
						aliases: ["Contrast shield strength"],
						control: {
							type: "dropdown",
							key: DEFAULT_CONTRAST_SHIELD_KEY,
							options: {
								none: "None",
								subtle: "Subtle",
								medium: "Medium",
								strong: "Strong",
							},
						},
					},
				],
			},
			{
				type: "group",
				heading: "Active-window shortcuts",
				cls: "window-overlay-settings-group",
				items: [
					this.shortcutDefinition(
						"Adjust opacity",
						"Decrease or increase the active window in 5% steps. With smart fade on, these adjust active opacity.",
						[
							["Decrease", DEFAULT_HOTKEYS.decreaseActiveWindowOpacity],
							["Increase", DEFAULT_HOTKEYS.increaseActiveWindowOpacity],
						],
					),
					this.shortcutDefinition(
						"Toggle always on top",
						"Pin or unpin whichever Obsidian window is active.",
						[["Shortcut", DEFAULT_HOTKEYS.toggleActiveWindowPinning]],
					),
					this.shortcutDefinition(
						"Restore active window",
						"Return the active window to 100% opacity and turn off smart fade for it.",
						[["Shortcut", DEFAULT_HOTKEYS.restoreActiveWindowOpacity]],
					),
					{
						name: "Customize shortcuts",
						desc: "Open Settings → Hotkeys and search for “Window Overlay” to change or remove any shortcut.",
						aliases: ["Hotkeys", "Keyboard shortcuts"],
					},
				],
			},
			{
				type: "group",
				heading: "Recovery",
				cls: "window-overlay-settings-group",
				items: [
					this.actionDefinition(
						"Restore every managed overlay",
						"Turn off smart fade and contrast shield, set every open window to 100%, and turn off pinning.",
						"Restore all",
						DEFAULT_HOTKEYS.restoreAllManagedWindows,
						() => this.windowOverlay.restoreAllWindows(),
					),
				],
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
		if (key === DEFAULT_CONTRAST_SHIELD_KEY) {
			return this.windowOverlay.currentSettings.defaultContrastShield;
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
		if (key === DEFAULT_CONTRAST_SHIELD_KEY && isContrastShieldLevel(value)) {
			this.windowOverlay.setDefaultContrastShield(value);
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

	private actionDefinition(
		name: string,
		description: string,
		buttonText: string,
		hotkeys: readonly Hotkey[],
		onClick: () => void,
		cta = false,
	): SettingDefinition {
		return {
			name,
			desc: descriptionWithHotkeys(description, hotkeys),
			render: (setting) => {
				setting.addButton((button) => {
					button.setButtonText(buttonText).onClick(onClick);
					if (cta) {
						button.setCta();
					}
				});
			},
		};
	}

	private shortcutDefinition(
		name: string,
		description: string,
		shortcuts: ReadonlyArray<readonly [string, readonly Hotkey[]]>,
	): SettingDefinition {
		return {
			name,
			desc: description,
			render: (setting) => {
				setting.setClass("window-overlay-shortcut-setting");
				for (const [label, hotkeys] of shortcuts) {
					appendHotkeyHints(setting.controlEl, hotkeys, label);
				}
			},
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
