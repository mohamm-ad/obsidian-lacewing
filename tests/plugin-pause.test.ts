import { afterEach, describe, expect, it, vi } from "vitest";
import { setIcon, setTooltip } from "obsidian";
import type { App, Command, PluginManifest } from "obsidian";
import WindowOverlayPlugin from "../src/main";

vi.mock("obsidian", () => ({
	Plugin: class {
		app = {
			workspace: { on: vi.fn(), onLayoutReady: vi.fn() },
			vault: { on: vi.fn() },
		};
		loadData = vi.fn(async () => null);
		saveData = vi.fn(async () => {});
		addSettingTab = vi.fn();
		registerEvent = vi.fn();
		addRibbonIcon = vi.fn(() => ({}));
		addCommand = vi.fn((command: Command) => command);
	},
	Platform: { isDesktopApp: true, isMacOS: true },
	Notice: class {},
	setIcon: vi.fn(),
	setTooltip: vi.fn(),
}));
vi.mock("../src/ui/window-overlay-setting-tab", () => ({ WindowOverlaySettingTab: class {} }));
vi.mock("../src/ui/window-manager-modal", () => ({ WindowManagerModal: class {} }));
vi.mock("../src/windows/obsidian-window-source", () => ({ ObsidianWindowSource: class {} }));
vi.mock("../src/native/electron-window-adapter", () => ({ ElectronWindowAdapter: { fromRuntime: () => ({}) } }));
vi.mock("../src/windows/window-registry", () => ({
	WindowRegistry: class {
		isPaused = false;
		setPaused(paused: boolean) { this.isPaused = paused; return true; }
		dispose() {}
	},
}));

afterEach(() => vi.unstubAllGlobals());

describe("pause command and ribbon", () => {
	it("registers the default shortcut and updates the ribbon through the actual command callback", async () => {
		vi.stubGlobal("window", globalThis);
		const plugin = new WindowOverlayPlugin({} as App, {} as PluginManifest);
		const addCommand = vi.spyOn(plugin, "addCommand");
		const addRibbon = vi.spyOn(plugin, "addRibbonIcon");
		await plugin.onload();
		try {
			const commands = addCommand.mock.calls.map(([command]) => command);
			const pause = commands.find((command) => command.id === "toggle-pause");
			expect(pause?.hotkeys).toEqual([{ modifiers: ["Mod", "Alt", "Shift"], key: "L" }]);
			expect(pause?.repeatable).not.toBe(true);
			expect(commands.filter((command) => command.hotkeys?.length)).toEqual([pause]);
			const ribbon = addRibbon.mock.results[0]?.value as HTMLElement;
			expect(setIcon).toHaveBeenLastCalledWith(ribbon, "picture-in-picture-2");
			expect(setTooltip).toHaveBeenLastCalledWith(ribbon, "Lacewing is on: Open window manager", { placement: "right" });
			if (!pause?.callback) throw new Error("Missing pause callback");
			pause.callback();
			expect(plugin.isPaused).toBe(true);
			expect(setIcon).toHaveBeenLastCalledWith(ribbon, "circle-pause");
			expect(setTooltip).toHaveBeenLastCalledWith(ribbon, "Lacewing is paused: Open window manager", { placement: "right" });
			pause.callback();
			expect(plugin.isPaused).toBe(false);
			expect(setIcon).toHaveBeenLastCalledWith(ribbon, "picture-in-picture-2");
		} finally {
			plugin.onunload();
		}
	});
});
