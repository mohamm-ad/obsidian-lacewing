import { describe, expect, it, vi } from "vitest";
import { noteWindowKey } from "../src/model/window-target";
import { PreferenceStore } from "../src/persistence/preference-store";

const timerHost = {
	setTimeout: (callback: () => void, milliseconds: number) =>
		globalThis.setTimeout(callback, milliseconds) as unknown as number,
	clearTimeout: (timer: number) => globalThis.clearTimeout(timer),
};

describe("preference store", () => {
	it("serializes clamped settings without leaking mutable state", async () => {
		const saved: unknown[] = [];
		const store = new PreferenceStore(
			null,
			async (settings) => {
				saved.push(settings);
			},
			150,
			timerHost,
		);
		const identity = { key: "main", reason: "main" } as const;

		expect(store.setPreference(identity, { opacity: 0.1, pinned: true })).toBe(
			true,
		);
		const snapshot = store.settings;
		if (snapshot.main) snapshot.main.opacity = 1;
		await store.flush();

		expect(saved).toEqual([
			{
				schemaVersion: 1,
				defaultOverlayOpacity: 0.85,
				main: { opacity: 0.5, pinned: true },
				notePopouts: {},
			},
		]);
		expect(store.resolve(identity)?.opacity).toBe(0.5);
	});

	it("debounces writes and supports note migration and reset", async () => {
		vi.useFakeTimers();
		const save = vi.fn(async () => {});
		const store = new PreferenceStore(null, save, 100, timerHost);
		const oldIdentity = {
			key: noteWindowKey("Old.md"),
			reason: "single-note",
		} as const;

		store.setPreference(oldIdentity, { opacity: 0.8, pinned: false });
		store.setPreference(oldIdentity, { opacity: 0.75, pinned: true });
		expect(save).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(100);
		expect(save).toHaveBeenCalledOnce();

		expect(store.migrateNote("Old.md", "New.md")).toBe(true);
		expect(
			store.resolve({ key: noteWindowKey("New.md"), reason: "single-note" }),
		).toEqual({ opacity: 0.75, pinned: true });
		expect(
			store.reset({ key: noteWindowKey("New.md"), reason: "single-note" }),
		).toBe(true);
		await store.flush();
		expect(store.settings.notePopouts).toEqual({});
		vi.useRealTimers();
	});

	it("never persists ambiguous session-only targets", () => {
		const store = new PreferenceStore(null, async () => {}, 150, timerHost);
		expect(
			store.setPreference(
				{ key: null, reason: "mixed" },
				{ opacity: 0.7, pinned: true },
			),
		).toBe(false);
		expect(store.settings.notePopouts).toEqual({});
	});
});
