import {
	DEFAULT_SMART_FADE_SETTINGS,
	MAX_OPACITY,
	clampOpacity,
	cloneWindowPreference,
	type SmartFadeSettings,
	type WindowPreference,
} from "../model/settings";
import {
	SmartFadeStateMachine,
	type SmartFadeState,
	type SmartFadeTimerHost,
} from "../behavior/smart-fade-state-machine";
import { OpacityTransition } from "../behavior/opacity-transition";
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
	private smartFadeSettings: SmartFadeSettings = {
		...DEFAULT_SMART_FADE_SETTINGS,
	};
	private readonly smartFade: SmartFadeStateMachine;
	private readonly opacityTransition: OpacityTransition;
	private readonly nativeListeners: Array<{
		event: NativeEventName;
		listener: NativeEventListener;
	}> = [];
	private readonly reapply = (): void => {
		this.applyCurrent();
	};
	private readonly reapplyImmediate = (): void => {
		this.applyCurrent(false);
	};
	private readonly handleFocus = (): void => {
		this.smartFade.focus();
		this.reapply();
	};
	private readonly handleBlur = (): void => {
		this.smartFade.blur();
		this.reapply();
	};
	private readonly handleKeyboard = (): void => {
		if (this.smartFadeSettings.brightenOnKeyboard) {
			this.smartFade.activity();
		}
	};
	private readonly handlePointer = (): void => {
		if (this.smartFadeSettings.brightenOnPointer) {
			this.smartFade.activity();
		}
	};
	private readonly handleVisibility = (): void => {
		if (this.document.hidden) {
			this.smartFade.blur();
		}
		this.reapply();
	};

	constructor(
		private readonly nativeWindow: NativeBrowserWindow,
		private readonly document: Document,
		private readonly onChange: () => void,
		timerHost: SmartFadeTimerHost = document.defaultView ?? window,
	) {
		this.snapshot = {
			opacity: this.readNativeOpacity(),
			pinned: this.readPinned(),
		};
		this.opacityTransition = new OpacityTransition(timerHost);
		this.smartFade = new SmartFadeStateMachine(
			this.smartFadeSettings,
			timerHost,
			() => this.applyCurrent(),
		);
		this.smartFade.start(this.isFocused);

		this.addNativeListener("focus", this.handleFocus);
		this.addNativeListener("blur", this.handleBlur);
		for (const event of ["restore", "show"] as const) {
			this.addNativeListener(event, this.reapplyImmediate);
		}
		this.addNativeListener("always-on-top-changed", this.onChange);
		this.document.defaultView?.addEventListener("focus", this.handleFocus);
		this.document.defaultView?.addEventListener("blur", this.handleBlur);
		this.document.addEventListener("keydown", this.handleKeyboard, true);
		this.document.addEventListener("pointerdown", this.handlePointer, true);
		this.document.addEventListener("wheel", this.handlePointer, true);
		this.document.addEventListener("scroll", this.handlePointer, true);
		this.document.addEventListener("visibilitychange", this.handleVisibility);
	}

	get id(): number {
		return this.nativeWindow.id;
	}

	get lastError(): string | null {
		return this.error;
	}

	get preference(): WindowPreference {
		return this.desired
			? cloneWindowPreference(this.desired)
			: {
					opacity: clampOpacity(this.snapshot.opacity),
					pinned: this.snapshot.pinned,
				};
	}

	get isFocused(): boolean {
		return !this.nativeWindow.isDestroyed() && this.nativeWindow.isFocused();
	}

	get smartFadeState(): SmartFadeState {
		return this.smartFade.currentState;
	}

	get smartFadeConfiguration(): SmartFadeSettings {
		return { ...this.smartFadeSettings };
	}

	get effectiveOpacity(): number {
		return this.smartFade.enabled
			? this.smartFade.currentOpacity
			: this.preference.opacity;
	}

	setPreference(preference: WindowPreference): boolean {
		this.desired = cloneWindowPreference({
			...preference,
			opacity: clampOpacity(preference.opacity),
		});
		return this.applyCurrent();
	}

	setSmartFade(settings: SmartFadeSettings): boolean {
		const wasEnabled = this.smartFade.enabled;
		this.smartFadeSettings = { ...settings };
		this.smartFade.update(this.smartFadeSettings, this.isFocused);
		if (wasEnabled && !settings.enabled && !this.desired) {
			return this.applyNative(
				this.snapshot.opacity,
				this.snapshot.pinned,
				false,
				false,
			);
		}
		return this.applyCurrent();
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
		this.opacityTransition.cancel();
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
		this.smartFade.stop();
		this.opacityTransition.cancel();
		for (const { event, listener } of this.nativeListeners) {
			this.nativeWindow.removeListener(event, listener);
		}
		this.nativeListeners.length = 0;
		this.document.defaultView?.removeEventListener("focus", this.handleFocus);
		this.document.defaultView?.removeEventListener("blur", this.handleBlur);
		this.document.removeEventListener("keydown", this.handleKeyboard, true);
		this.document.removeEventListener("pointerdown", this.handlePointer, true);
		this.document.removeEventListener("wheel", this.handlePointer, true);
		this.document.removeEventListener("scroll", this.handlePointer, true);
		this.document.removeEventListener("visibilitychange", this.handleVisibility);
		this.restoreOriginal();
	}

	private applyCurrent(animate = true): boolean {
		if (!this.desired && !this.smartFade.enabled) {
			return true;
		}

		const preference = this.desired ?? {
			opacity: this.snapshot.opacity,
			pinned: this.snapshot.pinned,
		};
		return this.applyNative(
			this.smartFade.enabled
				? this.smartFade.currentOpacity
				: preference.opacity,
			preference.pinned,
			this.smartFade.enabled || this.desired !== null,
			animate && this.smartFade.enabled,
		);
	}

	private applyNative(
		opacity: number,
		pinned: boolean,
		clamp: boolean,
		animate: boolean,
	): boolean {
		if (this.nativeWindow.isDestroyed()) {
			this.error = "The native window has closed.";
			this.onChange();
			return false;
		}

		try {
			const targetOpacity = clamp ? clampOpacity(opacity) : opacity;
			if (this.readPinned() !== pinned) {
				this.nativeWindow.setAlwaysOnTop(
					pinned,
					pinned ? "floating" : "normal",
				);
			}
			const currentOpacity = this.readNativeOpacity();
			const duration =
				animate && !this.shouldReduceMotion()
					? this.smartFadeSettings.transitionDurationMs
					: 0;
			let opacityApplied = true;
			this.error = null;
			this.opacityTransition.start(
				currentOpacity,
				targetOpacity,
				duration,
				(value) => {
					opacityApplied =
						this.writeTransitionOpacity(value, clamp) && opacityApplied;
				},
			);
			this.onChange();
			return opacityApplied;
		} catch (error) {
			this.error = error instanceof Error ? error.message : String(error);
			this.onChange();
			return false;
		}
	}

	private writeTransitionOpacity(opacity: number, clamp: boolean): boolean {
		if (this.nativeWindow.isDestroyed()) {
			this.opacityTransition.cancel();
			this.error = "The native window has closed.";
			this.onChange();
			return false;
		}

		try {
			const targetOpacity = clamp ? clampOpacity(opacity) : opacity;
			if (Math.abs(this.readNativeOpacity() - targetOpacity) > 0.001) {
				this.nativeWindow.setOpacity(targetOpacity);
			}
			this.error = null;
			return true;
		} catch (error) {
			this.opacityTransition.cancel();
			this.error = error instanceof Error ? error.message : String(error);
			this.onChange();
			return false;
		}
	}

	private shouldReduceMotion(): boolean {
		if (!this.smartFadeSettings.respectReducedMotion) {
			return false;
		}
		try {
			return (
				this.document.defaultView?.matchMedia?.(
					"(prefers-reduced-motion: reduce)",
				).matches === true
			);
		} catch {
			return false;
		}
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
