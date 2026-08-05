import { describe, expect, it, vi } from "vitest";
import { ActiveWindowCommands } from "../src/commands/active-window-commands";
import type { WindowTargetDescriptor } from "../src/model/window-target";

function descriptor(
	runtimeId: string,
	preference: WindowTargetDescriptor["preference"] = {
		opacity: 0.8,
		pinned: false,
	},
	smartFadeEnabled = false,
): WindowTargetDescriptor {
	return {
		runtimeId,
		kind: "popout",
		label: runtimeId,
		focused: true,
		persistence: { key: `note:${runtimeId}.md`, reason: "single-note" },
		preference,
		smartFade: {
			enabled: smartFadeEnabled,
			activeOpacity: 0.9,
			idleOpacity: 0.6,
			idleDelayMs: 1_250,
			fadeOnBlur: true,
			fadeOnInactivity: true,
			brightenOnKeyboard: true,
			brightenOnPointer: true,
			transitionDurationMs: 0,
			respectReducedMotion: true,
		},
		smartFadeState: "active",
		effectiveOpacity: smartFadeEnabled ? 0.9 : preference.opacity,
		contrastShield: "none",
		supported: true,
		error: null,
	};
}

describe("active window commands", () => {
	it("updates only the descriptor belonging to the active DOM window", () => {
		const mainWindow = {} as Window;
		const popoutWindow = {} as Window;
		const main = descriptor("main");
		const popout = descriptor("popout", { opacity: 0.55, pinned: true });
		const apply = vi.fn(() => true);
		const commands = new ActiveWindowCommands(
			{
				getTargetForWindow: (domWindow) =>
					domWindow === mainWindow ? main : popout,
			},
			apply,
		);

		expect(commands.decreaseOpacity(popoutWindow).status).toBe("applied");
		expect(apply).toHaveBeenCalledWith(popout, {
			opacity: 0.5,
			pinned: true,
		});
	});

	it("preserves pinning when restoring opacity", () => {
		const active = {} as Window;
		const target = descriptor("call", { opacity: 0.65, pinned: true });
		const apply = vi.fn(() => true);
		const commands = new ActiveWindowCommands(
			{
				getTargetForWindow: () => target,
			},
			apply,
		);

		commands.restoreOpacity(active);
		expect(apply).toHaveBeenCalledWith(target, {
			opacity: 1,
			pinned: true,
		});
	});

	it("adjusts active opacity while smart fade is enabled", () => {
		const active = {} as Window;
		const target = descriptor(
			"call",
			{ opacity: 0.75, pinned: true },
			true,
		);
		const apply = vi.fn(() => true);
		const commands = new ActiveWindowCommands(
			{ getTargetForWindow: () => target },
			apply,
		);

		commands.decreaseOpacity(active);
		expect(apply).toHaveBeenCalledWith(target, {
			opacity: 0.75,
			pinned: true,
			smartFade: { activeOpacity: 0.85 },
		});
	});

	it("disables smart fade when restoring the active window", () => {
		const active = {} as Window;
		const target = descriptor(
			"call",
			{
				opacity: 0.7,
				pinned: false,
				smartFade: { idleOpacity: 0.55 },
			},
			true,
		);
		const apply = vi.fn(() => true);
		const commands = new ActiveWindowCommands(
			{ getTargetForWindow: () => target },
			apply,
		);

		commands.restoreOpacity(active);
		expect(apply).toHaveBeenCalledWith(target, {
			opacity: 1,
			pinned: false,
			smartFade: { idleOpacity: 0.55, enabled: false },
		});
	});

	it("does not persist missing or unsupported targets", () => {
		const active = {} as Window;
		const apply = vi.fn(() => false);
		const commands = new ActiveWindowCommands(
			{
				getTargetForWindow: () => null,
			},
			apply,
		);

		expect(commands.togglePinning(active).status).toBe("no-target");
		expect(apply).not.toHaveBeenCalled();
	});
});
