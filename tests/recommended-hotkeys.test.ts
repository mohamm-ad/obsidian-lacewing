import { describe, expect, it } from "vitest";
import { RECOMMENDED_HOTKEYS } from "../src/commands/recommended-hotkeys";

describe("recommended hotkeys", () => {
	it("uses a unique Command-Option-Shift shortcut for every command", () => {
		const hotkeys = Object.values(RECOMMENDED_HOTKEYS).flat();
		const signatures = hotkeys.map(
			(hotkey) => `${hotkey.modifiers.join("+")}+${hotkey.key}`,
		);

		expect(new Set(signatures).size).toBe(signatures.length);
		for (const hotkey of hotkeys) {
			expect(hotkey.modifiers).toEqual(["Mod", "Alt", "Shift"]);
		}
	});
});
