export const SETTINGS_SCHEMA_VERSION = 1 as const;
export const MIN_OPACITY = 0.5;
export const MAX_OPACITY = 1;
export const OPACITY_STEP = 0.05;
export const DEFAULT_OVERLAY_OPACITY = 0.85;
export const MAIN_WINDOW_KEY = "main";

export interface WindowPreference {
	opacity: number;
	pinned: boolean;
}

export interface WindowOverlaySettings {
	schemaVersion: typeof SETTINGS_SCHEMA_VERSION;
	defaultOverlayOpacity: number;
	main: WindowPreference;
	notePopouts: Record<string, WindowPreference>;
}

export const DEFAULT_WINDOW_PREFERENCE: Readonly<WindowPreference> = {
	opacity: MAX_OPACITY,
	pinned: false,
};

export const DEFAULT_SETTINGS: Readonly<WindowOverlaySettings> = {
	schemaVersion: SETTINGS_SCHEMA_VERSION,
	defaultOverlayOpacity: DEFAULT_OVERLAY_OPACITY,
	main: DEFAULT_WINDOW_PREFERENCE,
	notePopouts: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function clampOpacity(value: unknown, fallback = MAX_OPACITY): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return fallback;
	}

	return Math.min(MAX_OPACITY, Math.max(MIN_OPACITY, value));
}

export function adjustOpacity(opacity: number, delta: number): number {
	const adjusted = clampOpacity(opacity + delta);
	return Math.round(adjusted * 100) / 100;
}

export function opacityPercent(opacity: number): number {
	return Math.round(clampOpacity(opacity) * 100);
}

function normalizePreference(
	value: unknown,
	fallback: WindowPreference = DEFAULT_WINDOW_PREFERENCE,
): WindowPreference {
	if (!isRecord(value)) {
		return { ...fallback };
	}

	return {
		opacity: clampOpacity(value.opacity, fallback.opacity),
		pinned:
			typeof value.pinned === "boolean" ? value.pinned : fallback.pinned,
	};
}

export function normalizeSettings(value: unknown): WindowOverlaySettings {
	if (!isRecord(value)) {
		return cloneSettings(DEFAULT_SETTINGS);
	}

	const notePopouts: Record<string, WindowPreference> = {};
	if (isRecord(value.notePopouts)) {
		for (const [path, preference] of Object.entries(value.notePopouts)) {
			if (path.trim().length > 0 && isRecord(preference)) {
				notePopouts[path] = normalizePreference(preference);
			}
		}
	}

	return {
		schemaVersion: SETTINGS_SCHEMA_VERSION,
		defaultOverlayOpacity: clampOpacity(
			value.defaultOverlayOpacity,
			DEFAULT_OVERLAY_OPACITY,
		),
		main: normalizePreference(value.main),
		notePopouts,
	};
}

export function cloneSettings(
	settings: Readonly<WindowOverlaySettings>,
): WindowOverlaySettings {
	return {
		schemaVersion: SETTINGS_SCHEMA_VERSION,
		defaultOverlayOpacity: settings.defaultOverlayOpacity,
		main: { ...settings.main },
		notePopouts: Object.fromEntries(
			Object.entries(settings.notePopouts).map(([path, preference]) => [
				path,
				{ ...preference },
			]),
		),
	};
}

export function migrateNotePreference(
	settings: WindowOverlaySettings,
	oldPath: string,
	newPath: string,
): boolean {
	const preference = settings.notePopouts[oldPath];
	if (!preference || oldPath === newPath || newPath.trim().length === 0) {
		return false;
	}

	if (!settings.notePopouts[newPath]) {
		settings.notePopouts[newPath] = preference;
	}
	delete settings.notePopouts[oldPath];
	return true;
}

export function removeNotePreference(
	settings: WindowOverlaySettings,
	path: string,
): boolean {
	if (!settings.notePopouts[path]) {
		return false;
	}

	delete settings.notePopouts[path];
	return true;
}

