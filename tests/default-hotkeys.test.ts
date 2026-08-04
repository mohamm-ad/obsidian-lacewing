import { describe, expect, it } from "vitest";
import { DEFAULT_HOTKEYS } from "../src/commands/default-hotkeys";

describe("default hotkeys", () => {
	it("uses a unique Command-Option-Shift shortcut for every command", () => {
		const hotkeys = Object.values(DEFAULT_HOTKEYS).flat();
		const signatures = hotkeys.map(
			(hotkey) => `${hotkey.modifiers.join("+")}+${hotkey.key}`,
		);

		expect(new Set(signatures).size).toBe(signatures.length);
		for (const hotkey of hotkeys) {
			expect(hotkey.modifiers).toEqual(["Mod", "Alt", "Shift"]);
		}
	});
});
