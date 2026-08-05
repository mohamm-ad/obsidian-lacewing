import { describe, expect, it } from "vitest";
import {
	clearSmartFadeOverrides,
	persistenceLabel,
	resetWindowPreference,
	smartFadeStatus,
	updateSmartFadeOverrides,
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

	it("summarizes active, idle, and disabled smart fade states", () => {
		const settings = {
			enabled: true,
			activeOpacity: 0.9,
			idleOpacity: 0.6,
			idleDelayMs: 1_250,
			fadeOnBlur: true,
			fadeOnInactivity: true,
			brightenOnKeyboard: true,
			brightenOnPointer: true,
		};

		expect(smartFadeStatus(settings, "active")).toBe("Active · 90%");
		expect(smartFadeStatus(settings, "idle")).toBe("Idle · 60%");
		expect(smartFadeStatus({ ...settings, enabled: false }, "idle")).toBe(
			"Off",
		);
	});

	it("updates and clears smart fade overrides without losing window controls", () => {
		const current = {
			opacity: 0.8,
			pinned: true,
			smartFade: { enabled: true, idleOpacity: 0.6 },
		};
		const updated = updateSmartFadeOverrides(current, {
			enabled: undefined,
			activeOpacity: 0.9,
		});

		expect(updated).toEqual({
			opacity: 0.8,
			pinned: true,
			smartFade: { idleOpacity: 0.6, activeOpacity: 0.9 },
		});
		expect(clearSmartFadeOverrides(updated)).toEqual({
			opacity: 0.8,
			pinned: true,
		});
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
