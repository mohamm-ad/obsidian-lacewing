import { afterEach, describe, expect, it, vi } from "vitest";
import {
	OpacityTransition,
	type TransitionTimerHost,
} from "../src/behavior/opacity-transition";

const timerHost: TransitionTimerHost = {
	setTimeout: (callback, milliseconds) =>
		globalThis.setTimeout(callback, milliseconds) as unknown as number,
	clearTimeout: (timer) => globalThis.clearTimeout(timer),
};

afterEach(() => {
	vi.useRealTimers();
});

describe("opacity transition", () => {
	it("applies zero-duration changes immediately", () => {
		const apply = vi.fn();
		const transition = new OpacityTransition(timerHost);
		transition.start(1, 0.6, 0, apply);

		expect(apply).toHaveBeenCalledOnce();
		expect(apply).toHaveBeenCalledWith(0.6);
		expect(transition.isRunning).toBe(false);
	});

	it("eases monotonically and finishes at the exact target", async () => {
		vi.useFakeTimers();
		const values: number[] = [];
		const transition = new OpacityTransition(timerHost);
		transition.start(1, 0.6, 180, (value) => values.push(value));
		await vi.advanceTimersByTimeAsync(180);

		expect(values.length).toBeGreaterThan(2);
		expect(values.at(-1)).toBeCloseTo(0.6);
		for (let index = 1; index < values.length; index += 1) {
			expect(values[index] ?? 0).toBeLessThan(values[index - 1] ?? 1);
		}
		expect(transition.isRunning).toBe(false);
	});

	it("interrupts an in-flight transition from its current value", async () => {
		vi.useFakeTimers();
		let current = 1;
		const transition = new OpacityTransition(timerHost);
		transition.start(1, 0.5, 200, (value) => {
			current = value;
		});
		await vi.advanceTimersByTimeAsync(64);
		const interruptedAt = current;
		transition.start(current, 0.9, 100, (value) => {
			current = value;
		});
		await vi.advanceTimersByTimeAsync(100);

		expect(interruptedAt).toBeLessThan(1);
		expect(current).toBeCloseTo(0.9);
		expect(transition.isRunning).toBe(false);
	});

	it("cancels without applying more frames", async () => {
		vi.useFakeTimers();
		const apply = vi.fn();
		const transition = new OpacityTransition(timerHost);
		transition.start(1, 0.5, 200, apply);
		transition.cancel();
		await vi.advanceTimersByTimeAsync(500);

		expect(apply).not.toHaveBeenCalled();
		expect(transition.isRunning).toBe(false);
	});
});
