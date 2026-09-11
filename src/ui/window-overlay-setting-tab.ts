import { PluginSettingTab } from "obsidian";
import type {
	App,
	Hotkey,
	SettingDefinition,
	SettingDefinitionItem,
	SettingDefinitionRender,
	SliderComponent,
} from "obsidian";
import { RECOMMENDED_HOTKEYS } from "../commands/recommended-hotkeys";
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
	private readonly opacitySliders = new Map<string, Set<SliderComponent>>();

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
						RECOMMENDED_HOTKEYS.openWindowManager,
						() => this.windowOverlay.openWindowManager(),
						true,
					),
					this.actionDefinition(
						"Open current note as an overlay",
						"Duplicate the active Markdown note into a pinned pop-out without moving the original tab.",
						"Open note",
						RECOMMENDED_HOTKEYS.openCurrentNoteAsOverlay,
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
				heading: "Global smart fade",
				cls: "window-overlay-settings-group",
				items: [
					{
						name: "Enable smart fade by default",
						desc: "Applies to all windows that use the global setting. Individual windows can override this in the Lacewing window manager.",
						control: {
							type: "toggle",
							key: SMART_FADE_ENABLED_KEY,
						},
					},
					{
						name: "Fade trigger",
						desc: "Choose what sends a window to idle. Focus loss only is best when you often read without interacting.",
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
								...RECOMMENDED_HOTKEYS.decreaseActiveWindowOpacity,
								...RECOMMENDED_HOTKEYS.increaseActiveWindowOpacity,
							],
							"Suggested",
						),
						render: this.smartFadeOpacitySlider(
							SMART_FADE_ACTIVE_OPACITY_KEY,
						),
					},
					{
						name: "Idle opacity",
						desc: "See-through opacity used when the selected trigger fades the window.",
						render: this.smartFadeOpacitySlider(
							SMART_FADE_IDLE_OPACITY_KEY,
						),
					},
					{
						name: "Idle delay",
						desc: "How long to wait after the last activity. Used only with an inactivity trigger.",
						control: {
							type: "slider",
							key: SMART_FADE_IDLE_DELAY_KEY,
							disabled: () => !this.usesInactivity,
							min: 250,
							max: 10_000,
							step: 250,
							displayFormat: (value) => this.formatDelay(value),
						},
					},
					{
						name: "Brighten on keyboard activity",
						desc: "Typing and navigation keys—including arrows and Page Up or Down—reset the idle timer.",
						control: this.smartFadeActivityToggle(
							SMART_FADE_ON_KEYBOARD_KEY,
						),
					},
					{
						name: "Brighten on pointer and scroll activity",
						desc: "Clicking or scrolling with a mouse, trackpad, or scrollbar resets the idle timer.",
						control: this.smartFadeActivityToggle(
							SMART_FADE_ON_POINTER_KEY,
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
							[
								"Suggested decrease",
								RECOMMENDED_HOTKEYS.decreaseActiveWindowOpacity,
							],
							[
								"Suggested increase",
								RECOMMENDED_HOTKEYS.increaseActiveWindowOpacity,
							],
						],
					),
					this.shortcutDefinition(
						"Toggle always on top",
						"Pin or unpin whichever Obsidian window is active.",
						[
							[
								"Suggested",
								RECOMMENDED_HOTKEYS.toggleActiveWindowPinning,
							],
						],
					),
					this.shortcutDefinition(
						"Restore active window",
						"Return the active window to 100% opacity and turn off smart fade for it.",
						[
							[
								"Suggested",
								RECOMMENDED_HOTKEYS.restoreActiveWindowOpacity,
							],
						],
					),
					{
						name: "Customize shortcuts",
						desc: "Suggested shortcuts are shown here but are not assigned automatically. Open Settings → Hotkeys and search for “Lacewing Window Transparency” to assign or customize them.",
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
						RECOMMENDED_HOTKEYS.restoreAllManagedWindows,
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
			this.syncOpacitySliders();
			if (
				key === SMART_FADE_ENABLED_KEY ||
				key === SMART_FADE_TRIGGER_KEY
			) {
				this.refreshDomState();
			}
		}
	}

	private get smartFadeDefaults(): SmartFadeSettings {
		return this.windowOverlay.currentSettings.smartFadeDefaults;
	}

	private smartFadeOpacitySlider(key: string): SettingDefinitionRender["render"] {
		return (setting) => {
			const sliders = this.opacitySliders.get(key) ?? new Set<SliderComponent>();
			this.opacitySliders.set(key, sliders);
			let renderedSlider: SliderComponent;
			setting.addSlider((slider) => {
				renderedSlider = slider;
				sliders.add(slider);
				slider
					.setInstant(true)
					.setDisplayFormat((value) => `${value}%`)
					.onChange((value) => this.setControlValue(key, value));
			});
			this.syncOpacitySliders();
			return () => sliders.delete(renderedSlider);
		};
	}

	private syncOpacitySliders(): void {
		const settings = this.smartFadeDefaults;
		for (const [key, sliders] of this.opacitySliders) {
			const isIdle = key === SMART_FADE_IDLE_OPACITY_KEY;
			const maximum = isIdle ? opacityPercent(settings.activeOpacity) : 100;
			const value = opacityPercent(isIdle ? settings.idleOpacity : settings.activeOpacity);
			for (const slider of sliders) {
				slider.setLimits(50, maximum, 1).setValue(value);
			}
		}
	}

	private get usesInactivity(): boolean {
		return this.smartFadeDefaults.fadeOnInactivity;
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
			desc: descriptionWithHotkeys(description, hotkeys, "Suggested"),
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
