import type { SmartFadeSettings } from "../model/settings";

export type SmartFadeState = "active" | "idle";

export interface SmartFadeTimerHost {
	setTimeout(callback: () => void, milliseconds: number): number;
	clearTimeout(timer: number): void;
}

export class SmartFadeStateMachine {
	private state: SmartFadeState = "active";
	private timer: number | null = null;
	private running = false;

	constructor(
		private settings: SmartFadeSettings,
		private readonly timerHost: SmartFadeTimerHost,
		private readonly onStateChange: (state: SmartFadeState) => void,
	) {}

	get currentState(): SmartFadeState {
		return this.state;
	}

	get currentOpacity(): number {
		return this.state === "idle"
			? this.settings.idleOpacity
			: this.settings.activeOpacity;
	}

	get enabled(): boolean {
		return this.settings.enabled;
	}

	start(focused: boolean): void {
		this.running = true;
		this.cancelTimer();
		this.state =
			this.settings.enabled && !focused && this.settings.fadeOnBlur
				? "idle"
				: "active";
		this.onStateChange(this.state);
		if (
			this.settings.enabled &&
			this.settings.fadeOnInactivity &&
			this.state === "active"
		) {
			this.scheduleIdle();
		}
	}

	update(settings: SmartFadeSettings, focused: boolean): void {
		this.settings = settings;
		if (!this.running) {
			return;
		}

		this.cancelTimer();
		if (!settings.enabled) {
			this.state = "active";
			this.onStateChange(this.state);
			return;
		}

		if (!focused && settings.fadeOnBlur) {
			this.state = "idle";
			this.onStateChange(this.state);
			return;
		}
		if (focused && !settings.fadeOnInactivity && this.state === "idle") {
			this.state = "active";
		}

		this.onStateChange(this.state);
		if (this.state === "active" && settings.fadeOnInactivity) {
			this.scheduleIdle();
		}
	}

	activity(): void {
		if (!this.running || !this.settings.enabled) {
			return;
		}

		this.setState("active");
		this.scheduleIdle();
	}

	focus(): void {
		this.activity();
	}

	blur(): void {
		if (
			!this.running ||
			!this.settings.enabled ||
			!this.settings.fadeOnBlur
		) {
			return;
		}

		this.cancelTimer();
		this.setState("idle");
	}

	stop(): void {
		this.running = false;
		this.cancelTimer();
	}

	private scheduleIdle(): void {
		this.cancelTimer();
		if (!this.settings.fadeOnInactivity) {
			return;
		}
		this.timer = this.timerHost.setTimeout(() => {
			this.timer = null;
			if (this.running && this.settings.enabled) {
				this.setState("idle");
			}
		}, this.settings.idleDelayMs);
	}

	private cancelTimer(): void {
		if (this.timer !== null) {
			this.timerHost.clearTimeout(this.timer);
			this.timer = null;
		}
	}

	private setState(state: SmartFadeState): void {
		if (this.state === state) {
			return;
		}
		this.state = state;
		this.onStateChange(state);
	}
}
