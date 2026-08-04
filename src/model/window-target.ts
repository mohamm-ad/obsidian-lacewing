import { MAIN_WINDOW_KEY, type WindowPreference } from "./settings";

export type WindowTargetKind = "main" | "popout";

export interface WindowLeafIdentity {
	type: string;
	filePath: string | null;
}

export interface PersistenceIdentity {
	key: string | null;
	reason: "main" | "single-note" | "mixed" | "non-note";
}

export interface WindowTargetDescriptor {
	runtimeId: string;
	kind: WindowTargetKind;
	label: string;
	focused: boolean;
	persistence: PersistenceIdentity;
	preference: WindowPreference;
	supported: boolean;
	error: string | null;
}

export function noteWindowKey(filePath: string): string {
	return `note:${filePath}`;
}

export function persistenceIdentity(
	kind: WindowTargetKind,
	leaves: readonly WindowLeafIdentity[],
): PersistenceIdentity {
	if (kind === "main") {
		return { key: MAIN_WINDOW_KEY, reason: "main" };
	}

	if (leaves.length !== 1) {
		return { key: null, reason: "mixed" };
	}

	const [leaf] = leaves;
	if (!leaf || leaf.type !== "markdown" || !leaf.filePath) {
		return { key: null, reason: "non-note" };
	}

	return { key: noteWindowKey(leaf.filePath), reason: "single-note" };
}

export function notePathFromWindowKey(key: string): string | null {
	return key.startsWith("note:") ? key.slice("note:".length) : null;
}

