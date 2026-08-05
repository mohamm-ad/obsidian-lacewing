export const SETTINGS_SCHEMA_VERSION = 2 as const;
export const MIN_OPACITY = 0.5;
export const MAX_OPACITY = 1;
export const OPACITY_STEP = 0.05;
export const DEFAULT_OVERLAY_OPACITY = 0.85;
export const MIN_IDLE_DELAY_MS = 250;
export const MAX_IDLE_DELAY_MS = 10_000;
export const DEFAULT_IDLE_DELAY_MS = 1_250;
export const MAIN_WINDOW_KEY = "main";

export interface SmartFadeSettings {
	enabled: boolean;
	activeOpacity: number;
	idleOpacity: number;
	idleDelayMs: number;
	fadeOnBlur: boolean;
	brightenOnKeyboard: boolean;
	brightenOnPointer: boolean;
}

export type SmartFadeOverrides = Partial<SmartFadeSettings>;

export interface WindowPreference {
	opacity: number;
	pinned: boolean;
	smartFade?: SmartFadeOverrides;
}

export interface WindowOverlaySettings {
	schemaVersion: typeof SETTINGS_SCHEMA_VERSION;
	defaultOverlayOpacity: number;
	smartFadeDefaults: SmartFadeSettings;
	main: WindowPreference | null;
	notePopouts: Record<string, WindowPreference>;
}

export const DEFAULT_WINDOW_PREFERENCE: Readonly<WindowPreference> = {
	opacity: MAX_OPACITY,
	pinned: false,
};

export const DEFAULT_SMART_FADE_SETTINGS: Readonly<SmartFadeSettings> = {
	enabled: false,
	activeOpacity: 0.92,
	idleOpacity: 0.6,
	idleDelayMs: DEFAULT_IDLE_DELAY_MS,
	fadeOnBlur: true,
	brightenOnKeyboard: true,
	brightenOnPointer: true,
};

export const DEFAULT_SETTINGS: Readonly<WindowOverlaySettings> = {
	schemaVersion: SETTINGS_SCHEMA_VERSION,
	defaultOverlayOpacity: DEFAULT_OVERLAY_OPACITY,
	smartFadeDefaults: DEFAULT_SMART_FADE_SETTINGS,
	main: null,
	notePopouts: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPreferenceRecord(
	value: unknown,
): value is Record<"opacity" | "pinned", unknown> {
	return (
		isRecord(value) &&
		typeof value.opacity === "number" &&
		Number.isFinite(value.opacity) &&
		typeof value.pinned === "boolean"
	);
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

export function clampIdleDelay(
	value: unknown,
	fallback = DEFAULT_IDLE_DELAY_MS,
): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return fallback;
	}

	return Math.round(
		Math.min(MAX_IDLE_DELAY_MS, Math.max(MIN_IDLE_DELAY_MS, value)),
	);
}

export function normalizeSmartFadeSettings(
	value: unknown,
	fallback: Readonly<SmartFadeSettings> = DEFAULT_SMART_FADE_SETTINGS,
): SmartFadeSettings {
	const record = isRecord(value) ? value : {};
	const activeOpacity = clampOpacity(
		record.activeOpacity,
		fallback.activeOpacity,
	);
	const idleOpacity = Math.min(
		activeOpacity,
		clampOpacity(record.idleOpacity, fallback.idleOpacity),
	);

	return {
		enabled:
			typeof record.enabled === "boolean" ? record.enabled : fallback.enabled,
		activeOpacity,
		idleOpacity,
		idleDelayMs: clampIdleDelay(record.idleDelayMs, fallback.idleDelayMs),
		fadeOnBlur:
			typeof record.fadeOnBlur === "boolean"
				? record.fadeOnBlur
				: fallback.fadeOnBlur,
		brightenOnKeyboard:
			typeof record.brightenOnKeyboard === "boolean"
				? record.brightenOnKeyboard
				: fallback.brightenOnKeyboard,
		brightenOnPointer:
			typeof record.brightenOnPointer === "boolean"
				? record.brightenOnPointer
				: fallback.brightenOnPointer,
	};
}

export function normalizeSmartFadeOverrides(
	value: unknown,
): SmartFadeOverrides | undefined {
	if (!isRecord(value)) {
		return undefined;
	}

	const overrides: SmartFadeOverrides = {};
	for (const key of [
		"enabled",
		"fadeOnBlur",
		"brightenOnKeyboard",
		"brightenOnPointer",
	] as const) {
		if (typeof value[key] === "boolean") {
			overrides[key] = value[key];
		}
	}
	for (const key of ["activeOpacity", "idleOpacity"] as const) {
		if (typeof value[key] === "number" && Number.isFinite(value[key])) {
			overrides[key] = clampOpacity(value[key]);
		}
	}
	if (typeof value.idleDelayMs === "number" && Number.isFinite(value.idleDelayMs)) {
		overrides.idleDelayMs = clampIdleDelay(value.idleDelayMs);
	}

	return Object.keys(overrides).length > 0 ? overrides : undefined;
}

export function normalizeWindowPreference(
	value: unknown,
	fallback: WindowPreference = DEFAULT_WINDOW_PREFERENCE,
): WindowPreference {
	if (!isRecord(value)) {
		return { ...fallback };
	}

	const preference: WindowPreference = {
		opacity: clampOpacity(value.opacity, fallback.opacity),
		pinned:
			typeof value.pinned === "boolean" ? value.pinned : fallback.pinned,
	};
	const smartFade = normalizeSmartFadeOverrides(value.smartFade);
	if (smartFade) {
		preference.smartFade = smartFade;
	}
	return preference;
}

export function cloneWindowPreference(
	preference: Readonly<WindowPreference>,
): WindowPreference {
	return {
		opacity: preference.opacity,
		pinned: preference.pinned,
		...(preference.smartFade
			? { smartFade: { ...preference.smartFade } }
			: {}),
	};
}

export function resolveSmartFadeSettings(
	defaults: Readonly<SmartFadeSettings>,
	preference: Readonly<WindowPreference> | null,
): SmartFadeSettings {
	const overrides = normalizeSmartFadeOverrides(preference?.smartFade) ?? {};
	return normalizeSmartFadeSettings({
		...defaults,
		...overrides,
	});
}

export function normalizeSettings(value: unknown): WindowOverlaySettings {
	if (!isRecord(value)) {
		return cloneSettings(DEFAULT_SETTINGS);
	}

	const notePopouts: Record<string, WindowPreference> = {};
	if (isRecord(value.notePopouts)) {
		for (const [path, preference] of Object.entries(value.notePopouts)) {
			if (path.trim().length > 0 && isPreferenceRecord(preference)) {
				notePopouts[path] = normalizeWindowPreference(preference);
			}
		}
	}

	return {
		schemaVersion: SETTINGS_SCHEMA_VERSION,
		defaultOverlayOpacity: clampOpacity(
			value.defaultOverlayOpacity,
			DEFAULT_OVERLAY_OPACITY,
		),
		smartFadeDefaults: normalizeSmartFadeSettings(value.smartFadeDefaults),
		main: isPreferenceRecord(value.main)
			? normalizeWindowPreference(value.main)
			: null,
		notePopouts,
	};
}

export function cloneSettings(
	settings: Readonly<WindowOverlaySettings>,
): WindowOverlaySettings {
	return {
		schemaVersion: SETTINGS_SCHEMA_VERSION,
		defaultOverlayOpacity: settings.defaultOverlayOpacity,
		smartFadeDefaults: { ...settings.smartFadeDefaults },
		main: settings.main ? cloneWindowPreference(settings.main) : null,
		notePopouts: Object.fromEntries(
			Object.entries(settings.notePopouts).map(([path, preference]) => [
				path,
				cloneWindowPreference(preference),
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
