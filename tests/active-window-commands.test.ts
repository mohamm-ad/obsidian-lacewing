import { describe, expect, it, vi } from "vitest";
import { ActiveWindowCommands } from "../src/commands/active-window-commands";
import type { WindowTargetDescriptor } from "../src/model/window-target";

function descriptor(
	runtimeId: string,
	preference = { opacity: 0.8, pinned: false },
): WindowTargetDescriptor {
	return {
		runtimeId,
		kind: "popout",
		label: runtimeId,
		focused: true,
		persistence: { key: `note:${runtimeId}.md`, reason: "single-note" },
		preference,
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
		const setPreference = vi.fn(() => true);
		const persist = vi.fn();
		const commands = new ActiveWindowCommands(
			{
				getTargetForWindow: (domWindow) =>
					domWindow === mainWindow ? main : popout,
				setPreference,
			},
			persist,
		);

		expect(commands.decreaseOpacity(popoutWindow).status).toBe("applied");
		expect(setPreference).toHaveBeenCalledWith("popout", {
			opacity: 0.5,
			pinned: true,
		});
		expect(persist).toHaveBeenCalledOnce();
	});

	it("preserves pinning when restoring opacity", () => {
		const active = {} as Window;
		const target = descriptor("call", { opacity: 0.65, pinned: true });
		const setPreference = vi.fn(() => true);
		const commands = new ActiveWindowCommands(
			{
				getTargetForWindow: () => target,
				setPreference,
			},
			vi.fn(),
		);

		commands.restoreOpacity(active);
		expect(setPreference).toHaveBeenCalledWith("call", {
			opacity: 1,
			pinned: true,
		});
	});

	it("does not persist missing or unsupported targets", () => {
		const active = {} as Window;
		const persist = vi.fn();
		const commands = new ActiveWindowCommands(
			{
				getTargetForWindow: () => null,
				setPreference: vi.fn(() => false),
			},
			persist,
		);

		expect(commands.togglePinning(active).status).toBe("no-target");
		expect(persist).not.toHaveBeenCalled();
	});
});
