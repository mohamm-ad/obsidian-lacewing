import type { Hotkey } from "obsidian";

const OVERLAY_MODIFIERS = ["Mod", "Alt", "Shift"] as const;

function overlayHotkey(key: string): Hotkey[] {
	return [{ modifiers: [...OVERLAY_MODIFIERS], key }];
}

export const DEFAULT_HOTKEYS = {
	openWindowManager: overlayHotkey("O"),
	openCurrentNoteAsOverlay: overlayHotkey("N"),
	increaseActiveWindowOpacity: overlayHotkey("]"),
	decreaseActiveWindowOpacity: overlayHotkey("["),
	toggleActiveWindowPinning: overlayHotkey("P"),
	restoreActiveWindowOpacity: overlayHotkey("0"),
	restoreAllManagedWindows: overlayHotkey("R"),
} satisfies Record<string, Hotkey[]>;
