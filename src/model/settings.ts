export const SETTINGS_SCHEMA_VERSION = 5 as const;
export const MIN_OPACITY = 0.5;
export const MAX_OPACITY = 1;
export const OPACITY_STEP = 0.05;
export const DEFAULT_OVERLAY_OPACITY = 0.85;
export const MIN_IDLE_DELAY_MS = 250;
export const MAX_IDLE_DELAY_MS = 10_000;
export const DEFAULT_IDLE_DELAY_MS = 1_250;
export const MIN_TRANSITION_DURATION_MS = 0;
export const MAX_TRANSITION_DURATION_MS = 500;
export const DEFAULT_TRANSITION_DURATION_MS = 180;
export const MAIN_WINDOW_KEY = "main";

export type ContrastShieldLevel = "none" | "subtle" | "medium" | "strong";
export const DEFAULT_CONTRAST_SHIELD: ContrastShieldLevel = "none";

export function isContrastShieldLevel(
	value: unknown,
): value is ContrastShieldLevel {
	return (
		value === "none" ||
		value === "subtle" ||
		value === "medium" ||
		value === "strong"
	);
}

export interface SmartFadeSettings {
	enabled: boolean;
	activeOpacity: number;
	idleOpacity: number;
	idleDelayMs: number;
	fadeOnBlur: boolean;
	fadeOnInactivity: boolean;
	brightenOnKeyboard: boolean;
	brightenOnPointer: boolean;
	transitionDurationMs: number;
	respectReducedMotion: boolean;
}

export type SmartFadeOverrides = Partial<SmartFadeSettings>;
export type SmartFadeTrigger =
	| "inactivity-and-focus-loss"
	| "focus-loss-only"
	| "inactivity-only";

export function isSmartFadeTrigger(value: unknown): value is SmartFadeTrigger {
	return (
		value === "inactivity-and-focus-loss" ||
		value === "focus-loss-only" ||
		value === "inactivity-only"
	);
}

export interface WindowPreference {
	opacity: number;
	pinned: boolean;
	smartFade?: SmartFadeOverrides;
	contrastShield?: ContrastShieldLevel;
}

export interface WindowOverlaySettings {
	schemaVersion: typeof SETTINGS_SCHEMA_VERSION;
	defaultOverlayOpacity: number;
	defaultContrastShield: ContrastShieldLevel;
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
	fadeOnInactivity: true,
	brightenOnKeyboard: true,
	brightenOnPointer: true,
	transitionDurationMs: DEFAULT_TRANSITION_DURATION_MS,
	respectReducedMotion: true,
};

export const DEFAULT_SETTINGS: Readonly<WindowOverlaySettings> = {
	schemaVersion: SETTINGS_SCHEMA_VERSION,
	defaultOverlayOpacity: DEFAULT_OVERLAY_OPACITY,
	defaultContrastShield: DEFAULT_CONTRAST_SHIELD,
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

export function clampTransitionDuration(
	value: unknown,
	fallback = DEFAULT_TRANSITION_DURATION_MS,
): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return fallback;
	}

	return Math.round(
		Math.min(
			MAX_TRANSITION_DURATION_MS,
			Math.max(MIN_TRANSITION_DURATION_MS, value),
		),
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
	const fadeOnInactivity =
		typeof record.fadeOnInactivity === "boolean"
			? record.fadeOnInactivity
			: fallback.fadeOnInactivity;
	const requestedFadeOnBlur =
		typeof record.fadeOnBlur === "boolean"
			? record.fadeOnBlur
			: fallback.fadeOnBlur;

	return {
		enabled:
			typeof record.enabled === "boolean" ? record.enabled : fallback.enabled,
		activeOpacity,
		idleOpacity,
		idleDelayMs: clampIdleDelay(record.idleDelayMs, fallback.idleDelayMs),
		fadeOnBlur: requestedFadeOnBlur || !fadeOnInactivity,
		fadeOnInactivity,
		brightenOnKeyboard:
			typeof record.brightenOnKeyboard === "boolean"
				? record.brightenOnKeyboard
				: fallback.brightenOnKeyboard,
		brightenOnPointer:
			typeof record.brightenOnPointer === "boolean"
				? record.brightenOnPointer
				: fallback.brightenOnPointer,
		transitionDurationMs: clampTransitionDuration(
			record.transitionDurationMs,
			fallback.transitionDurationMs,
		),
		respectReducedMotion:
			typeof record.respectReducedMotion === "boolean"
				? record.respectReducedMotion
				: fallback.respectReducedMotion,
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
		"fadeOnInactivity",
		"brightenOnKeyboard",
		"brightenOnPointer",
		"respectReducedMotion",
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
	if (
		typeof value.transitionDurationMs === "number" &&
		Number.isFinite(value.transitionDurationMs)
	) {
		overrides.transitionDurationMs = clampTransitionDuration(
			value.transitionDurationMs,
		);
	}

	return Object.keys(overrides).length > 0 ? overrides : undefined;
}

export function smartFadeTrigger(
	settings: Pick<SmartFadeSettings, "fadeOnBlur" | "fadeOnInactivity">,
): SmartFadeTrigger {
	if (!settings.fadeOnInactivity) {
		return "focus-loss-only";
	}
	return settings.fadeOnBlur
		? "inactivity-and-focus-loss"
		: "inactivity-only";
}

export function smartFadeTriggerOverrides(
	trigger: SmartFadeTrigger,
): Pick<SmartFadeSettings, "fadeOnBlur" | "fadeOnInactivity"> {
	return {
		fadeOnBlur: trigger !== "inactivity-only",
		fadeOnInactivity: trigger !== "focus-loss-only",
	};
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
	if (isContrastShieldLevel(value.contrastShield)) {
		preference.contrastShield = value.contrastShield;
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
		...(preference.contrastShield
			? { contrastShield: preference.contrastShield }
			: {}),
	};
}

export function resolveContrastShield(
	defaultLevel: ContrastShieldLevel,
	preference: Readonly<WindowPreference> | null,
): ContrastShieldLevel {
	return preference?.contrastShield ?? defaultLevel;
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
	const schemaVersion =
		typeof value.schemaVersion === "number" ? value.schemaVersion : null;
	const smartFadeFallback =
		schemaVersion !== null && schemaVersion < SETTINGS_SCHEMA_VERSION
			? { ...DEFAULT_SMART_FADE_SETTINGS, transitionDurationMs: 0 }
			: DEFAULT_SMART_FADE_SETTINGS;

	return {
		schemaVersion: SETTINGS_SCHEMA_VERSION,
		defaultOverlayOpacity: clampOpacity(
			value.defaultOverlayOpacity,
			DEFAULT_OVERLAY_OPACITY,
		),
		defaultContrastShield: isContrastShieldLevel(value.defaultContrastShield)
			? value.defaultContrastShield
			: DEFAULT_CONTRAST_SHIELD,
		smartFadeDefaults: normalizeSmartFadeSettings(
			value.smartFadeDefaults,
			smartFadeFallback,
		),
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
		defaultContrastShield: settings.defaultContrastShield,
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
