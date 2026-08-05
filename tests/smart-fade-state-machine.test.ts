import { afterEach, describe, expect, it, vi } from "vitest";
import {
	SmartFadeStateMachine,
	type SmartFadeTimerHost,
} from "../src/behavior/smart-fade-state-machine";
import {
	DEFAULT_SMART_FADE_SETTINGS,
	type SmartFadeSettings,
} from "../src/model/settings";

const timerHost: SmartFadeTimerHost = {
	setTimeout: (callback, milliseconds) =>
		globalThis.setTimeout(callback, milliseconds) as unknown as number,
	clearTimeout: (timer) => globalThis.clearTimeout(timer),
};

function settings(
	patch: Partial<SmartFadeSettings> = {},
): SmartFadeSettings {
	return { ...DEFAULT_SMART_FADE_SETTINGS, enabled: true, ...patch };
}

afterEach(() => {
	vi.useRealTimers();
});

describe("smart fade state machine", () => {
	it("fades an active window after the configured idle delay", async () => {
		vi.useFakeTimers();
		const changes = vi.fn();
		const machine = new SmartFadeStateMachine(
			settings({ idleDelayMs: 1_250 }),
			timerHost,
			changes,
		);

		machine.start(true);
		expect(machine.currentState).toBe("active");
		expect(machine.currentOpacity).toBe(0.92);
		await vi.advanceTimersByTimeAsync(1_249);
		expect(machine.currentState).toBe("active");
		await vi.advanceTimersByTimeAsync(1);
		expect(machine.currentState).toBe("idle");
		expect(machine.currentOpacity).toBe(0.6);
		expect(changes).toHaveBeenLastCalledWith("idle");
	});

	it("brightens on activity and resets the idle timer", async () => {
		vi.useFakeTimers();
		const machine = new SmartFadeStateMachine(
			settings({ idleDelayMs: 1_000 }),
			timerHost,
			vi.fn(),
		);
		machine.start(true);
		await vi.advanceTimersByTimeAsync(900);
		machine.activity();
		await vi.advanceTimersByTimeAsync(900);
		expect(machine.currentState).toBe("active");
		await vi.advanceTimersByTimeAsync(100);
		expect(machine.currentState).toBe("idle");
		machine.activity();
		expect(machine.currentState).toBe("active");
	});

	it("starts and remains idle while an unfocused window uses fade on blur", () => {
		const machine = new SmartFadeStateMachine(
			settings(),
			timerHost,
			vi.fn(),
		);
		machine.start(false);
		expect(machine.currentState).toBe("idle");
		machine.focus();
		expect(machine.currentState).toBe("active");
		machine.blur();
		expect(machine.currentState).toBe("idle");
	});

	it("lets the idle timer continue when fade on blur is disabled", async () => {
		vi.useFakeTimers();
		const machine = new SmartFadeStateMachine(
			settings({ fadeOnBlur: false, idleDelayMs: 500 }),
			timerHost,
			vi.fn(),
		);
		machine.start(true);
		machine.blur();
		expect(machine.currentState).toBe("active");
		await vi.advanceTimersByTimeAsync(500);
		expect(machine.currentState).toBe("idle");
	});

	it("disabling smart fade cancels timers and returns to active state", async () => {
		vi.useFakeTimers();
		const changes = vi.fn();
		const machine = new SmartFadeStateMachine(
			settings({ idleDelayMs: 500 }),
			timerHost,
			changes,
		);
		machine.start(true);
		machine.update(settings({ enabled: false }), true);
		await vi.advanceTimersByTimeAsync(500);

		expect(machine.enabled).toBe(false);
		expect(machine.currentState).toBe("active");
		expect(changes).toHaveBeenLastCalledWith("active");
	});

	it("stops cleanly without firing a pending idle transition", async () => {
		vi.useFakeTimers();
		const changes = vi.fn();
		const machine = new SmartFadeStateMachine(
			settings({ idleDelayMs: 500 }),
			timerHost,
			changes,
		);
		machine.start(true);
		machine.stop();
		await vi.advanceTimersByTimeAsync(500);

		expect(changes).toHaveBeenCalledOnce();
		expect(machine.currentState).toBe("active");
	});
});
