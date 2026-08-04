import { describe, expect, it } from "vitest";
import {
	DEFAULT_OVERLAY_OPACITY,
	MAX_OPACITY,
	MIN_OPACITY,
	adjustOpacity,
	clampOpacity,
	migrateNotePreference,
	normalizeSettings,
	opacityPercent,
	removeNotePreference,
} from "../src/model/settings";
import {
	notePathFromWindowKey,
	noteWindowKey,
	persistenceIdentity,
} from "../src/model/window-target";

describe("opacity safety", () => {
	it("clamps invalid and out-of-range opacity values", () => {
		expect(clampOpacity(0)).toBe(MIN_OPACITY);
		expect(clampOpacity(2)).toBe(MAX_OPACITY);
		expect(clampOpacity(Number.NaN, DEFAULT_OVERLAY_OPACITY)).toBe(
			DEFAULT_OVERLAY_OPACITY,
		);
	});

	it("adjusts in stable percentage steps", () => {
		expect(adjustOpacity(0.85, 0.05)).toBe(0.9);
		expect(adjustOpacity(0.52, -0.05)).toBe(MIN_OPACITY);
		expect(opacityPercent(0.849)).toBe(85);
	});
});

describe("settings normalization", () => {
	it("uses safe defaults for malformed data", () => {
		const settings = normalizeSettings({
			defaultOverlayOpacity: 0.1,
			main: { opacity: "invisible", pinned: "yes" },
			notePopouts: {
				"Meetings/Call.md": { opacity: 0.76, pinned: true },
				"": { opacity: 0.8, pinned: false },
				invalid: null,
			},
		});

		expect(settings.defaultOverlayOpacity).toBe(MIN_OPACITY);
		expect(settings.main).toBeNull();
		expect(settings.notePopouts).toEqual({
			"Meetings/Call.md": { opacity: 0.76, pinned: true },
		});
	});

	it("migrates and removes note preferences", () => {
		const settings = normalizeSettings({
			notePopouts: {
				"Old.md": { opacity: 0.8, pinned: true },
			},
		});

		expect(migrateNotePreference(settings, "Old.md", "New.md")).toBe(true);
		expect(settings.notePopouts["New.md"]).toEqual({
			opacity: 0.8,
			pinned: true,
		});
		expect(removeNotePreference(settings, "New.md")).toBe(true);
		expect(removeNotePreference(settings, "New.md")).toBe(false);
	});
});

describe("persistence classification", () => {
	it("persists the main window and single markdown popouts", () => {
		expect(persistenceIdentity("main", [])).toEqual({
			key: "main",
			reason: "main",
		});
		expect(
			persistenceIdentity("popout", [
				{ type: "markdown", filePath: "Meetings/Call.md" },
			]),
		).toEqual({
			key: "note:Meetings/Call.md",
			reason: "single-note",
		});
	});

	it("keeps mixed and non-note popouts session-only", () => {
		expect(
			persistenceIdentity("popout", [
				{ type: "markdown", filePath: "One.md" },
				{ type: "markdown", filePath: "Two.md" },
			]),
		).toEqual({ key: null, reason: "mixed" });
		expect(
			persistenceIdentity("popout", [
				{ type: "graph", filePath: null },
			]),
		).toEqual({ key: null, reason: "non-note" });
	});

	it("round-trips note persistence keys", () => {
		const key = noteWindowKey("Daily/2026-08-04.md");
		expect(notePathFromWindowKey(key)).toBe("Daily/2026-08-04.md");
		expect(notePathFromWindowKey("main")).toBeNull();
	});
});
