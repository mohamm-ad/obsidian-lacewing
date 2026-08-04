import { describe, expect, it } from "vitest";
import {
	persistenceLabel,
	resetWindowPreference,
	updateWindowPreference,
} from "../src/ui/window-manager-model";

describe("window manager model", () => {
	it("updates one preference field without losing the other", () => {
		expect(
			updateWindowPreference(
				{ opacity: 0.8, pinned: true },
				{ opacity: 0.1 },
			),
		).toEqual({ opacity: 0.5, pinned: true });
		expect(resetWindowPreference()).toEqual({ opacity: 1, pinned: false });
	});

	it("explains saved and session-only behavior", () => {
		expect(persistenceLabel({ key: "main", reason: "main" }, true)).toBe(
			"Saved for this vault",
		);
		expect(persistenceLabel({ key: null, reason: "mixed" }, false)).toMatch(
			/mixed tabs/u,
		);
		expect(
			persistenceLabel({ key: null, reason: "duplicate-note" }, false),
		).toMatch(/multiple pop-outs/u);
	});
});
