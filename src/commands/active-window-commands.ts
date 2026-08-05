import {
	MAX_OPACITY,
	OPACITY_STEP,
	adjustOpacity,
	type WindowPreference,
} from "../model/settings";
import type { WindowTargetDescriptor } from "../model/window-target";

export interface CommandWindowRegistry {
	getTargetForWindow(domWindow: Window): WindowTargetDescriptor | null;
}

export type CommandResult =
	| { status: "applied"; descriptor: WindowTargetDescriptor }
	| { status: "no-target" }
	| { status: "unsupported"; descriptor: WindowTargetDescriptor };

export class ActiveWindowCommands {
	constructor(
		private readonly registry: CommandWindowRegistry,
		private readonly apply: (
			descriptor: WindowTargetDescriptor,
			preference: WindowPreference,
		) => boolean,
	) {}

	increaseOpacity(domWindow: Window): CommandResult {
		return this.updateOpacity(domWindow, OPACITY_STEP);
	}

	decreaseOpacity(domWindow: Window): CommandResult {
		return this.updateOpacity(domWindow, -OPACITY_STEP);
	}

	togglePinning(domWindow: Window): CommandResult {
		return this.update(domWindow, (descriptor) => ({
			...descriptor.preference,
			pinned: !descriptor.preference.pinned,
		}));
	}

	restoreOpacity(domWindow: Window): CommandResult {
		return this.update(domWindow, (descriptor) => ({
			...descriptor.preference,
			...(descriptor.smartFade.enabled
				? {
						smartFade: {
							...descriptor.preference.smartFade,
							enabled: false,
						},
					}
				: {}),
			opacity: MAX_OPACITY,
		}));
	}

	private updateOpacity(domWindow: Window, delta: number): CommandResult {
		return this.update(domWindow, (descriptor) => {
			const current = descriptor.preference;
			if (descriptor.smartFade.enabled) {
				return {
					...current,
					smartFade: {
						...current.smartFade,
						activeOpacity: adjustOpacity(
							descriptor.smartFade.activeOpacity,
							delta,
						),
					},
				};
			}
			return {
			...current,
				opacity: adjustOpacity(current.opacity, delta),
			};
		});
	}

	private update(
		domWindow: Window,
		transform: (descriptor: WindowTargetDescriptor) => WindowPreference,
	): CommandResult {
		const descriptor = this.registry.getTargetForWindow(domWindow);
		if (!descriptor) {
			return { status: "no-target" };
		}
		if (!descriptor.supported) {
			return { status: "unsupported", descriptor };
		}

		const preference = transform(descriptor);
		if (!this.apply(descriptor, preference)) {
			return { status: "unsupported", descriptor };
		}
		return { status: "applied", descriptor };
	}
}
