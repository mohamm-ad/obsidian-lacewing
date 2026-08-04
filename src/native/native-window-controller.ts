import {
	MAX_OPACITY,
	clampOpacity,
	type WindowPreference,
} from "../model/settings";
import type {
	NativeBrowserWindow,
	NativeEventListener,
	NativeEventName,
} from "./electron-window-adapter";

export interface NativeWindowSnapshot {
	opacity: number;
	pinned: boolean;
}

export class NativeWindowController {
	private desired: WindowPreference | null = null;
	private error: string | null = null;
	private readonly snapshot: NativeWindowSnapshot;
	private readonly nativeListeners: Array<{
		event: NativeEventName;
		listener: NativeEventListener;
	}> = [];
	private readonly reapply = (): void => {
		if (this.desired) {
			this.apply(this.desired);
		}
	};

	constructor(
		private readonly nativeWindow: NativeBrowserWindow,
		private readonly document: Document,
		private readonly onChange: () => void,
	) {
		this.snapshot = {
			opacity: this.readNativeOpacity(),
			pinned: this.readPinned(),
		};

		for (const event of ["focus", "restore", "show"] as const) {
			this.addNativeListener(event, this.reapply);
		}
		this.addNativeListener("always-on-top-changed", this.onChange);
		this.document.defaultView?.addEventListener("focus", this.reapply);
		this.document.addEventListener("visibilitychange", this.reapply);
	}

	get id(): number {
		return this.nativeWindow.id;
	}

	get lastError(): string | null {
		return this.error;
	}

	get preference(): WindowPreference {
		return this.desired
			? { ...this.desired }
			: { opacity: this.readOpacity(), pinned: this.readPinned() };
	}

	get isFocused(): boolean {
		return !this.nativeWindow.isDestroyed() && this.nativeWindow.isFocused();
	}

	setPreference(preference: WindowPreference): boolean {
		this.desired = {
			opacity: clampOpacity(preference.opacity),
			pinned: preference.pinned,
		};
		return this.apply(this.desired);
	}

	focus(): void {
		if (this.nativeWindow.isDestroyed()) {
			return;
		}

		if (this.nativeWindow.isMinimized()) {
			this.nativeWindow.restore();
		}
		this.nativeWindow.show();
		this.nativeWindow.focus();
	}

	restoreOriginal(): void {
		if (this.nativeWindow.isDestroyed()) {
			return;
		}

		try {
			this.nativeWindow.setOpacity(this.snapshot.opacity);
			this.nativeWindow.setAlwaysOnTop(
				this.snapshot.pinned,
				this.snapshot.pinned ? "floating" : "normal",
			);
		} catch {
			// Unloading must remain safe even if Electron tears down first.
		}
	}

	dispose(): void {
		for (const { event, listener } of this.nativeListeners) {
			this.nativeWindow.removeListener(event, listener);
		}
		this.nativeListeners.length = 0;
		this.document.defaultView?.removeEventListener("focus", this.reapply);
		this.document.removeEventListener("visibilitychange", this.reapply);
		this.restoreOriginal();
	}

	private apply(preference: WindowPreference): boolean {
		if (this.nativeWindow.isDestroyed()) {
			this.error = "The native window has closed.";
			this.onChange();
			return false;
		}

		try {
			this.nativeWindow.setOpacity(clampOpacity(preference.opacity));
			this.nativeWindow.setAlwaysOnTop(
				preference.pinned,
				preference.pinned ? "floating" : "normal",
			);
			this.error = null;
			this.onChange();
			return true;
		} catch (error) {
			this.error = error instanceof Error ? error.message : String(error);
			this.onChange();
			return false;
		}
	}

	private readOpacity(): number {
		return clampOpacity(this.readNativeOpacity(), MAX_OPACITY);
	}

	private readNativeOpacity(): number {
		try {
			const opacity = this.nativeWindow.getOpacity();
			return Number.isFinite(opacity)
				? Math.min(MAX_OPACITY, Math.max(0, opacity))
				: MAX_OPACITY;
		} catch {
			return MAX_OPACITY;
		}
	}

	private readPinned(): boolean {
		try {
			return this.nativeWindow.isAlwaysOnTop();
		} catch {
			return false;
		}
	}

	private addNativeListener(
		event: NativeEventName,
		listener: NativeEventListener,
	): void {
		this.nativeWindow.on(event, listener);
		this.nativeListeners.push({ event, listener });
	}
}
