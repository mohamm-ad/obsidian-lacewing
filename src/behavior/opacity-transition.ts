export interface TransitionTimerHost {
	setTimeout(callback: () => void, milliseconds: number): number;
	clearTimeout(timer: number): void;
}

const FRAME_INTERVAL_MS = 16;

export class OpacityTransition {
	private timer: number | null = null;
	private generation = 0;

	constructor(private readonly timerHost: TransitionTimerHost) {}

	get isRunning(): boolean {
		return this.timer !== null;
	}

	start(
		from: number,
		to: number,
		durationMs: number,
		apply: (opacity: number) => void,
	): void {
		this.cancel();
		if (durationMs <= 0 || Math.abs(from - to) <= 0.001) {
			apply(to);
			return;
		}

		const generation = this.generation;
		const frameCount = Math.max(1, Math.ceil(durationMs / FRAME_INTERVAL_MS));
		const frameDuration = durationMs / frameCount;
		let frame = 0;
		const tick = (): void => {
			if (generation !== this.generation) {
				return;
			}
			this.timer = null;
			frame += 1;
			const progress = frame / frameCount;
			const easedProgress = 1 - Math.pow(1 - progress, 3);
			apply(from + (to - from) * easedProgress);
			if (frame < frameCount && generation === this.generation) {
				this.timer = this.timerHost.setTimeout(tick, frameDuration);
			}
		};

		this.timer = this.timerHost.setTimeout(tick, frameDuration);
	}

	cancel(): void {
		this.generation += 1;
		if (this.timer !== null) {
			this.timerHost.clearTimeout(this.timer);
			this.timer = null;
		}
	}
}
