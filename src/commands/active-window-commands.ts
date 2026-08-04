import {
	MAX_OPACITY,
	OPACITY_STEP,
	adjustOpacity,
	type WindowPreference,
} from "../model/settings";
import type { WindowTargetDescriptor } from "../model/window-target";

export interface CommandWindowRegistry {
	getTargetForWindow(domWindow: Window): WindowTargetDescriptor | null;
	setPreference(runtimeId: string, preference: WindowPreference): boolean;
}

export type CommandResult =
	| { status: "applied"; descriptor: WindowTargetDescriptor }
	| { status: "no-target" }
	| { status: "unsupported"; descriptor: WindowTargetDescriptor };

export class ActiveWindowCommands {
	constructor(
		private readonly registry: CommandWindowRegistry,
		private readonly persist: (
			descriptor: WindowTargetDescriptor,
			preference: WindowPreference,
		) => void,
	) {}

	increaseOpacity(domWindow: Window): CommandResult {
		return this.update(domWindow, (current) => ({
			...current,
			opacity: adjustOpacity(current.opacity, OPACITY_STEP),
		}));
	}

	decreaseOpacity(domWindow: Window): CommandResult {
		return this.update(domWindow, (current) => ({
			...current,
			opacity: adjustOpacity(current.opacity, -OPACITY_STEP),
		}));
	}

	togglePinning(domWindow: Window): CommandResult {
		return this.update(domWindow, (current) => ({
			...current,
			pinned: !current.pinned,
		}));
	}

	restoreOpacity(domWindow: Window): CommandResult {
		return this.update(domWindow, (current) => ({
			...current,
			opacity: MAX_OPACITY,
		}));
	}

	private update(
		domWindow: Window,
		transform: (current: WindowPreference) => WindowPreference,
	): CommandResult {
		const descriptor = this.registry.getTargetForWindow(domWindow);
		if (!descriptor) {
			return { status: "no-target" };
		}
		if (!descriptor.supported) {
			return { status: "unsupported", descriptor };
		}

		const preference = transform(descriptor.preference);
		if (!this.registry.setPreference(descriptor.runtimeId, preference)) {
			return { status: "unsupported", descriptor };
		}
		this.persist(descriptor, preference);
		return { status: "applied", descriptor };
	}
}
