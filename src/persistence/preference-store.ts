import {
	DEFAULT_SETTINGS,
	DEFAULT_WINDOW_PREFERENCE,
	MAIN_WINDOW_KEY,
	cloneSettings,
	cloneWindowPreference,
	clampOpacity,
	isContrastShieldLevel,
	migrateNotePreference,
	normalizeSettings,
	normalizeSmartFadeSettings,
	normalizeWindowPreference,
	removeNotePreference,
	resolveContrastShield,
	resolveSmartFadeSettings,
	type SmartFadeSettings,
	type ContrastShieldLevel,
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
	private dirty = false;
	private disposed = false;

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

	replace(rawSettings: unknown): void {
		if (this.timer) {
			this.timerHost.clearTimeout(this.timer);
			this.timer = null;
		}
		this.dirty = false;
		this.value = normalizeSettings(rawSettings);
	}

	resolve(identity: PersistenceIdentity): WindowPreference | null {
		if (identity.key === MAIN_WINDOW_KEY) {
			return this.value.main
				? cloneWindowPreference(this.value.main)
				: null;
		}

		const path = identity.key ? notePathFromWindowKey(identity.key) : null;
		const preference = path ? this.value.notePopouts[path] : null;
		return preference ? cloneWindowPreference(preference) : null;
	}

	resolveSmartFade(identity: PersistenceIdentity): SmartFadeSettings {
		return resolveSmartFadeSettings(
			this.value.smartFadeDefaults,
			this.resolve(identity),
		);
	}

	resolveContrastShield(identity: PersistenceIdentity): ContrastShieldLevel {
		return resolveContrastShield(
			this.value.defaultContrastShield,
			this.resolve(identity),
		);
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

		const normalized = normalizeWindowPreference(preference);
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

	setDefaultContrastShield(level: ContrastShieldLevel): void {
		if (!isContrastShieldLevel(level)) {
			return;
		}
		this.value.defaultContrastShield = level;
		this.scheduleSave();
	}

	setSmartFadeDefaults(patch: Partial<SmartFadeSettings>): void {
		this.value.smartFadeDefaults = normalizeSmartFadeSettings({
			...this.value.smartFadeDefaults,
			...patch,
		});
		this.scheduleSave();
	}

	migrateNote(oldPath: string, newPath: string): boolean {
		if (!migrateNotePreference(this.value, oldPath, newPath)) {
			return false;
		}
		this.scheduleSave();
		return true;
	}

	migratePath(oldPath: string, newPath: string): boolean {
		let changed = false;
		for (const path of Object.keys(this.value.notePopouts)) {
			if (path === oldPath || path.startsWith(`${oldPath}/`)) {
				const migratedPath = `${newPath}${path.slice(oldPath.length)}`;
				changed =
					migrateNotePreference(this.value, path, migratedPath) || changed;
			}
		}
		if (changed) {
			this.scheduleSave();
		}
		return changed;
	}

	removeNote(path: string): boolean {
		if (!removeNotePreference(this.value, path)) {
			return false;
		}
		this.scheduleSave();
		return true;
	}

	removePath(path: string): boolean {
		let changed = false;
		for (const savedPath of Object.keys(this.value.notePopouts)) {
			if (savedPath === path || savedPath.startsWith(`${path}/`)) {
				changed = removeNotePreference(this.value, savedPath) || changed;
			}
		}
		if (changed) {
			this.scheduleSave();
		}
		return changed;
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
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		if (this.timer) {
			this.timerHost.clearTimeout(this.timer);
			this.timer = null;
		}
		this.enqueueSave();
	}

	private scheduleSave(): void {
		this.dirty = true;
		if (this.disposed) {
			return;
		}
		if (this.timer) {
			this.timerHost.clearTimeout(this.timer);
		}
		this.timer = this.timerHost.setTimeout(() => {
			this.timer = null;
			this.enqueueSave();
		}, this.debounceMs);
	}

	private enqueueSave(): void {
		if (!this.dirty) {
			return;
		}
		this.dirty = false;
		const snapshot = cloneSettings(this.value);
		this.saveQueue = this.saveQueue
			.catch(() => undefined)
			.then(() => this.save(snapshot));
	}
}

export function defaultWindowPreference(): WindowPreference {
	return { ...DEFAULT_WINDOW_PREFERENCE };
}

export function emptySettings(): WindowOverlaySettings {
	return cloneSettings(DEFAULT_SETTINGS);
}
