import type { Hotkey, Modifier } from "obsidian";

const MODIFIER_SYMBOLS: Record<Modifier, string> = {
	Mod: "⌘",
	Ctrl: "⌃",
	Meta: "⌘",
	Shift: "⇧",
	Alt: "⌥",
};

const MODIFIER_NAMES: Record<Modifier, string> = {
	Mod: "Command",
	Ctrl: "Control",
	Meta: "Command",
	Shift: "Shift",
	Alt: "Option",
};

const KEY_NAMES: Record<string, string> = {
	"[": "Left bracket",
	"]": "Right bracket",
	" ": "Space",
	ArrowUp: "Up arrow",
	ArrowDown: "Down arrow",
	ArrowLeft: "Left arrow",
	ArrowRight: "Right arrow",
};

export interface HotkeyLabel {
	compact: string;
	accessible: string;
}

export function formatHotkey(hotkey: Hotkey): HotkeyLabel {
	const key = hotkey.key.length === 1 ? hotkey.key.toUpperCase() : hotkey.key;
	return {
		compact: `${hotkey.modifiers
			.map((modifier) => MODIFIER_SYMBOLS[modifier])
			.join("")}${key}`,
		accessible: [
			...hotkey.modifiers.map((modifier) => MODIFIER_NAMES[modifier]),
			KEY_NAMES[hotkey.key] ?? key,
		].join(" "),
	};
}

export function appendHotkeyHints(
	container: HTMLElement,
	hotkeys: readonly Hotkey[],
	label = "Shortcut",
): void {
	const wrapper = container.createSpan({
		cls: "window-overlay-hotkey-list",
	});
	wrapper.createSpan({
		cls: "window-overlay-hotkey-label",
		text: label,
	});
	for (const hotkey of hotkeys) {
		const formatted = formatHotkey(hotkey);
		wrapper.createEl("kbd", {
			cls: "window-overlay-hotkey",
			text: formatted.compact,
			attr: {
				"aria-label": formatted.accessible,
				title: formatted.accessible,
			},
		});
	}
}

export function descriptionWithHotkeys(
	description: string,
	hotkeys: readonly Hotkey[],
	label = "Shortcut",
): DocumentFragment {
	const fragment = createFragment();
	fragment.append(description);
	const hintContainer = fragment.createSpan();
	appendHotkeyHints(hintContainer, hotkeys, label);
	return fragment;
}
