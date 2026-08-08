import { describe, expect, it } from "vitest";
import { formatHotkey } from "../src/ui/hotkey-hint";

describe("hotkey hints", () => {
	it("formats the macOS modifier family compactly and accessibly", () => {
		expect(
			formatHotkey({
				modifiers: ["Mod", "Alt", "Shift"],
				key: "o",
			}),
		).toEqual({
			compact: "⌘⌥⇧O",
			accessible: "Command Option Shift O",
		});
	});

	it("gives punctuation keys a spoken name", () => {
		expect(
			formatHotkey({
				modifiers: ["Mod", "Alt", "Shift"],
				key: "[",
			}),
		).toEqual({
			compact: "⌘⌥⇧[",
			accessible: "Command Option Shift Left bracket",
		});
	});
});
