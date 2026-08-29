import type { Hotkey } from "obsidian";

const LACEWING_MODIFIERS = ["Mod", "Alt", "Shift"] as const;

function recommendedHotkey(key: string): Hotkey[] {
	return [{ modifiers: [...LACEWING_MODIFIERS], key }];
}

export const RECOMMENDED_HOTKEYS = {
	openWindowManager: recommendedHotkey("O"),
	openCurrentNoteAsOverlay: recommendedHotkey("N"),
	increaseActiveWindowOpacity: recommendedHotkey("]"),
	decreaseActiveWindowOpacity: recommendedHotkey("["),
	toggleActiveWindowPinning: recommendedHotkey("P"),
	restoreActiveWindowOpacity: recommendedHotkey("0"),
	restoreAllManagedWindows: recommendedHotkey("R"),
} satisfies Record<string, Hotkey[]>;
