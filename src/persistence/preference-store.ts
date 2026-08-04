import {
	DEFAULT_SETTINGS,
	DEFAULT_WINDOW_PREFERENCE,
	MAIN_WINDOW_KEY,
	cloneSettings,
	clampOpacity,
	migrateNotePreference,
	normalizeSettings,
	removeNotePreference,
	type WindowOverlaySettings,
	type WindowPreference,
} from "../model/settings";
import {
	notePathFromWindowKey,
	type PersistenceIdentity,
} from "../model/window-target";

export type SettingsSaver = (settings: WindowOverlaySettings) => Promise<void>;

export interface TimerHost {
	setTimeout(callback: () => void, milliseconds: number): number;
	clearTimeout(timer: number): void;
}

export class PreferenceStore {
	private value: WindowOverlaySettings;
	private timer: number | null = null;
	private saveQueue: Promise<void> = Promise.resolve();

	constructor(
		rawSettings: unknown,
		private readonly save: SettingsSaver,
		private readonly debounceMs = 150,
		private readonly timerHost: TimerHost = window,
	) {
		this.value = normalizeSettings(rawSettings);
	}

	get settings(): WindowOverlaySettings {
		return cloneSettings(this.value);
	}

	resolve(identity: PersistenceIdentity): WindowPreference | null {
		if (identity.key === MAIN_WINDOW_KEY) {
			return this.value.main ? { ...this.value.main } : null;
		}

		const path = identity.key ? notePathFromWindowKey(identity.key) : null;
		const preference = path ? this.value.notePopouts[path] : null;
		return preference ? { ...preference } : null;
	}

	has(identity: PersistenceIdentity): boolean {
		return this.resolve(identity) !== null;
	}

	setPreference(
		identity: PersistenceIdentity,
		preference: WindowPreference,
	): boolean {
		if (!identity.key) {
			return false;
		}

		const normalized = {
			opacity: clampOpacity(preference.opacity),
			pinned: preference.pinned,
		};
		if (identity.key === MAIN_WINDOW_KEY) {
			this.value.main = normalized;
		} else {
			const path = notePathFromWindowKey(identity.key);
			if (!path) {
				return false;
			}
			this.value.notePopouts[path] = normalized;
		}
		this.scheduleSave();
		return true;
	}

	reset(identity: PersistenceIdentity): boolean {
		if (identity.key === MAIN_WINDOW_KEY) {
			if (!this.value.main) {
				return false;
			}
			this.value.main = null;
			this.scheduleSave();
			return true;
		}

		const path = identity.key ? notePathFromWindowKey(identity.key) : null;
		if (!path || !removeNotePreference(this.value, path)) {
			return false;
		}
		this.scheduleSave();
		return true;
	}

	resetAll(): void {
		this.value.main = null;
		this.value.notePopouts = {};
		this.scheduleSave();
	}

	setDefaultOverlayOpacity(opacity: number): void {
		this.value.defaultOverlayOpacity = clampOpacity(opacity);
		this.scheduleSave();
	}

	migrateNote(oldPath: string, newPath: string): boolean {
		if (!migrateNotePreference(this.value, oldPath, newPath)) {
			return false;
		}
		this.scheduleSave();
		return true;
	}

	removeNote(path: string): boolean {
		if (!removeNotePreference(this.value, path)) {
			return false;
		}
		this.scheduleSave();
		return true;
	}

	async flush(): Promise<void> {
		if (this.timer) {
			this.timerHost.clearTimeout(this.timer);
			this.timer = null;
		}
		this.enqueueSave();
		await this.saveQueue;
	}

	dispose(): void {
		if (this.timer) {
			this.timerHost.clearTimeout(this.timer);
			this.timer = null;
		}
		this.enqueueSave();
	}

	private scheduleSave(): void {
		if (this.timer) {
			this.timerHost.clearTimeout(this.timer);
		}
		this.timer = this.timerHost.setTimeout(() => {
			this.timer = null;
			this.enqueueSave();
		}, this.debounceMs);
	}

	private enqueueSave(): void {
		const snapshot = cloneSettings(this.value);
		this.saveQueue = this.saveQueue.then(() => this.save(snapshot));
	}
}

export function defaultWindowPreference(): WindowPreference {
	return { ...DEFAULT_WINDOW_PREFERENCE };
}

export function emptySettings(): WindowOverlaySettings {
	return cloneSettings(DEFAULT_SETTINGS);
}
