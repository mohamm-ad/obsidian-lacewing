import { describe, expect, it, vi } from "vitest";
import type { App, Setting, SettingGroup, SettingDefinitionGroup, SliderComponent } from "obsidian";
import type WindowOverlayPlugin from "../src/main";
import { DEFAULT_SMART_FADE_SETTINGS, normalizeSettings, normalizeSmartFadeSettings } from "../src/model/settings";
import type { WindowTargetDescriptor } from "../src/model/window-target";
import type { WindowRegistry } from "../src/windows/window-registry";
import { WindowManagerModal, type WindowManagerActions } from "../src/ui/window-manager-modal";
import { windowManagerStructure } from "../src/ui/window-manager-model";
import { WindowOverlaySettingTab } from "../src/ui/window-overlay-setting-tab";

vi.mock("../src/ui/hotkey-hint", () => ({
	descriptionWithHotkeys: (description: string) => description,
}));

vi.mock("obsidian", () => ({
	Modal: class {
		modalEl = { addClass: vi.fn() };
		setTitle = vi.fn();
	},
	PluginSettingTab: class {
		update = vi.fn();
		refreshDomState = vi.fn();
	},
}));

function descriptor(): WindowTargetDescriptor {
	return {
		runtimeId: "main", kind: "main", label: "Vault", focused: true,
		persistence: { key: "main", reason: "main" },
		preference: { opacity: 1, pinned: false },
		smartFade: { ...DEFAULT_SMART_FADE_SETTINGS, enabled: true, fadeOnInactivity: true },
		smartFadeState: "active", effectiveOpacity: 0.92,
		contrastShield: "none", supported: true, error: null,
	};
}

describe("smart fade UI stability", () => {
	it("updates runtime status without rebuilding controls, but refreshes changed preferences", () => {
		const current = descriptor();
		let notify = () => {};
		const registry = {
			descriptors: [current],
			onChange: (callback: () => void) => { notify = callback; return () => {}; },
		} as unknown as WindowRegistry;
		const modal = new WindowManagerModal({} as App, registry, {} as WindowManagerActions);
		// Substitute only the DOM drawing; exercise the real registry subscription.
		const view = modal as unknown as {
			structure: string; render(): void; updateStatuses(): void;
		};
		const render = vi.spyOn(view, "render").mockImplementation(() => {
			view.structure = windowManagerStructure(registry.descriptors);
		});
		const statuses = vi.spyOn(view, "updateStatuses").mockImplementation(() => {});
		modal.onOpen();
		current.smartFadeState = "idle";
		current.effectiveOpacity = 0.6;
		notify();
		current.focused = false;
		notify();
		expect(render).toHaveBeenCalledTimes(1);
		expect(statuses).toHaveBeenCalledTimes(2);
		current.smartFade.idleDelayMs = 7_000;
		notify();
		expect(render).toHaveBeenCalledTimes(2);
	});

	it("keeps global controls visible and refreshes disabled state without rebuilding the tab", () => {
		const currentSettings = normalizeSettings(null);
		const plugin = {
			currentSettings,
			setSmartFadeDefaults: (patch: object) => Object.assign(currentSettings.smartFadeDefaults, patch),
		} as unknown as WindowOverlayPlugin;
		const tab = new WindowOverlaySettingTab({} as App, plugin);
		const update = vi.spyOn(tab, "update");
		const refresh = vi.spyOn(tab, "refreshDomState");
		const group = tab.getSettingDefinitions().find((item) =>
			"heading" in item && item.heading === "Global smart fade") as SettingDefinitionGroup;
		expect(group.items).toHaveLength(9);
		for (const item of group.items ?? []) expect(item).not.toHaveProperty("visible");
		tab.setControlValue("smartFadeEnabled", true);
		tab.setControlValue("smartFadeTrigger", "inactivity-only");
		expect(tab.getControlValue("smartFadeEnabled")).toBe(true);
		expect(tab.getControlValue("smartFadeTrigger")).toBe("inactivity-only");
		expect(update).not.toHaveBeenCalled();
		expect(refresh).toHaveBeenCalledTimes(2);
	});
});

class OpacitySlider {
	value = 0;
	maximum = 100;
	change = (_value: number) => {};
	setInstant() { return this; }
	setDisplayFormat() { return this; }
	setLimits(_minimum: number, maximum: number) { this.maximum = maximum; return this; }
	setValue(value: number) { this.value = value; return this; }
	onChange(callback: (value: number) => void) { this.change = callback; return this; }
}

describe("global opacity sliders", () => {
	it("updates both rendered sliders after normalization without rebuilding and releases unmounted controls", () => {
		const currentSettings = normalizeSettings({
			smartFadeDefaults: { activeOpacity: 0.9, idleOpacity: 0.8 },
		});
		const plugin = {
			currentSettings,
			setSmartFadeDefaults: (patch: object) => {
				currentSettings.smartFadeDefaults = normalizeSmartFadeSettings({
					...currentSettings.smartFadeDefaults, ...patch,
				});
			},
		} as unknown as WindowOverlayPlugin;
		const tab = new WindowOverlaySettingTab({} as App, plugin);
		const update = vi.spyOn(tab, "update");
		const group = tab.getSettingDefinitions().find((item) =>
			"heading" in item && item.heading === "Global smart fade") as SettingDefinitionGroup;
		const mount = (name: string) => {
			const definition = group.items?.find((item) => "name" in item && item.name === name);
			if (!definition || !("render" in definition) || !definition.render) {
				throw new Error(`Missing slider: ${name}`);
			}
			const slider = new OpacitySlider();
			const cleanup = definition.render({
				addSlider: (callback: (slider: SliderComponent) => void) => callback(slider as unknown as SliderComponent),
			} as unknown as Setting, {} as SettingGroup);
			return { slider, cleanup };
		};
		const active = mount("Active opacity");
		const idle = mount("Idle opacity");
		expect([active.slider.value, idle.slider.value, idle.slider.maximum]).toEqual([90, 80, 90]);

		active.slider.change(70);
		expect([active.slider.value, idle.slider.value, idle.slider.maximum]).toEqual([70, 70, 70]);
		expect(currentSettings.smartFadeDefaults.idleOpacity).toBe(0.7);
		active.slider.change(90);
		expect([active.slider.value, idle.slider.value, idle.slider.maximum]).toEqual([90, 70, 90]);
		idle.slider.change(100);
		expect(idle.slider.value).toBe(90);
		expect(currentSettings.smartFadeDefaults.idleOpacity).toBe(0.9);
		expect(update).not.toHaveBeenCalled();

		if (typeof idle.cleanup === "function") idle.cleanup();
		const replacement = mount("Idle opacity");
		active.slider.change(60);
		expect(replacement.slider.value).toBe(60);
		expect(idle.slider.value).toBe(90);
	});
});
