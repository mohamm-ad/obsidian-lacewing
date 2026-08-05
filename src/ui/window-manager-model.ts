import {
	DEFAULT_WINDOW_PREFERENCE,
	clampOpacity,
	cloneWindowPreference,
	type SmartFadeOverrides,
	type WindowPreference,
} from "../model/settings";
import type { PersistenceIdentity } from "../model/window-target";

export function updateWindowPreference(
	current: WindowPreference,
	patch: Partial<WindowPreference>,
): WindowPreference {
	return {
		...current,
		...patch,
		opacity: clampOpacity(patch.opacity ?? current.opacity),
		pinned: patch.pinned ?? current.pinned,
	};
}

export function resetWindowPreference(): WindowPreference {
	return { ...DEFAULT_WINDOW_PREFERENCE };
}

export function updateSmartFadeOverrides(
	current: WindowPreference,
	patch: SmartFadeOverrides,
): WindowPreference {
	const preference = cloneWindowPreference(current);
	const overrides: SmartFadeOverrides = { ...preference.smartFade };
	for (const [key, value] of Object.entries(patch) as Array<
		[keyof SmartFadeOverrides, SmartFadeOverrides[keyof SmartFadeOverrides]]
	>) {
		if (value === undefined) {
			delete overrides[key];
		} else {
			Object.assign(overrides, { [key]: value });
		}
	}

	if (Object.keys(overrides).length > 0) {
		preference.smartFade = overrides;
	} else {
		delete preference.smartFade;
	}
	return preference;
}

export function clearSmartFadeOverrides(
	current: WindowPreference,
): WindowPreference {
	const preference = cloneWindowPreference(current);
	delete preference.smartFade;
	return preference;
}

export function persistenceLabel(
	identity: PersistenceIdentity,
	saved: boolean,
): string {
	if (identity.reason === "main") {
		return saved ? "Saved for this vault" : "Uses defaults until changed";
	}
	if (identity.reason === "single-note") {
		return saved ? "Saved for this note" : "Uses defaults until changed";
	}
	if (identity.reason === "duplicate-note") {
		return "Session only — note is open in multiple pop-outs";
	}
	if (identity.reason === "mixed") {
		return "Session only — mixed tabs";
	}
	return "Session only — not a Markdown note";
}
