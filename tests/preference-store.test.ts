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
				schemaVersion: 5,
				defaultOverlayOpacity: 0.85,
				defaultContrastShield: "none",
				smartFadeDefaults: {
					enabled: false,
					activeOpacity: 0.92,
					idleOpacity: 0.6,
					idleDelayMs: 1_250,
					fadeOnBlur: true,
					fadeOnInactivity: true,
					brightenOnKeyboard: true,
					brightenOnPointer: true,
					transitionDurationMs: 180,
					respectReducedMotion: true,
				},
				main: { opacity: 0.5, pinned: true },
				notePopouts: {},
			},
		]);
		expect(store.resolve(identity)?.opacity).toBe(0.5);
	});

	it("persists and resolves contrast shield defaults and overrides", async () => {
		const save = vi.fn(async () => {});
		const store = new PreferenceStore(null, save, 100, timerHost);
		const main = { key: "main", reason: "main" } as const;
		store.setDefaultContrastShield("medium");
		store.setPreference(main, {
			opacity: 0.8,
			pinned: false,
			contrastShield: "strong",
		});

		expect(store.resolveContrastShield(main)).toBe("strong");
		expect(
			store.resolveContrastShield({ key: null, reason: "mixed" }),
		).toBe("medium");
		await store.flush();
		expect(save).toHaveBeenCalledOnce();
	});

	it("persists global smart fade defaults and resolves target overrides", async () => {
		const save = vi.fn(async () => {});
		const store = new PreferenceStore(null, save, 100, timerHost);
		const main = { key: "main", reason: "main" } as const;
		store.setSmartFadeDefaults({ enabled: true, activeOpacity: 0.9 });
		store.setPreference(main, {
			opacity: 0.8,
			pinned: false,
			smartFade: { idleOpacity: 0.65 },
		});

		expect(store.resolveSmartFade(main)).toMatchObject({
			enabled: true,
			activeOpacity: 0.9,
			idleOpacity: 0.65,
		});
		await store.flush();
		expect(save).toHaveBeenCalledOnce();
	});

	it("keeps idle opacity at or below the active opacity", () => {
		const store = new PreferenceStore(null, async () => {}, 100, timerHost);
		store.setSmartFadeDefaults({ idleOpacity: 0.9, activeOpacity: 0.7 });

		expect(store.settings.smartFadeDefaults).toMatchObject({
			activeOpacity: 0.7,
			idleOpacity: 0.7,
		});
	});

	it("resolves a focus-loss-only trigger for one window", () => {
		const store = new PreferenceStore(null, async () => {}, 100, timerHost);
		const main = { key: "main", reason: "main" } as const;
		store.setSmartFadeDefaults({ enabled: true });
		store.setPreference(main, {
			opacity: 0.8,
			pinned: false,
			smartFade: {
				fadeOnBlur: true,
				fadeOnInactivity: false,
				transitionDurationMs: 220,
				respectReducedMotion: false,
			},
		});

		expect(store.resolveSmartFade(main)).toMatchObject({
			enabled: true,
			fadeOnBlur: true,
			fadeOnInactivity: false,
			transitionDurationMs: 220,
			respectReducedMotion: false,
		});
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

	it("migrates and removes saved preferences beneath folders", async () => {
		const store = new PreferenceStore(
			{
				notePopouts: {
					"Meetings/Call.md": { opacity: 0.8, pinned: true },
					"Meetings/Notes.md": { opacity: 0.9, pinned: false },
				},
			},
			async () => {},
			150,
			timerHost,
		);

		expect(store.migratePath("Meetings", "Archive/Meetings")).toBe(true);
		expect(Object.keys(store.settings.notePopouts)).toEqual([
			"Archive/Meetings/Call.md",
			"Archive/Meetings/Notes.md",
		]);
		expect(store.removePath("Archive")).toBe(true);
		expect(store.settings.notePopouts).toEqual({});
		await store.flush();
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

	it("flushes one pending write on disposal and cancels its timer", async () => {
		vi.useFakeTimers();
		const save = vi.fn(async () => {});
		const store = new PreferenceStore(null, save, 100, timerHost);
		store.setDefaultOverlayOpacity(0.7);

		store.dispose();
		store.dispose();
		await vi.runAllTimersAsync();
		await Promise.resolve();

		expect(save).toHaveBeenCalledOnce();
		vi.useRealTimers();
	});

	it("replaces pending local data when settings change externally", async () => {
		vi.useFakeTimers();
		const save = vi.fn(async () => {});
		const store = new PreferenceStore(null, save, 100, timerHost);
		store.setDefaultOverlayOpacity(0.7);
		store.replace({
			defaultOverlayOpacity: 0.9,
			main: { opacity: 0.8, pinned: true },
		});
		await vi.runAllTimersAsync();

		expect(save).not.toHaveBeenCalled();
		expect(store.settings.defaultOverlayOpacity).toBe(0.9);
		expect(store.settings.main).toEqual({ opacity: 0.8, pinned: true });
		vi.useRealTimers();
	});
});
