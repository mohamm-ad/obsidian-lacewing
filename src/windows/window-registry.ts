import {
	DEFAULT_WINDOW_PREFERENCE,
	type WindowPreference,
} from "../model/settings";
import {
	persistenceIdentity,
	type PersistenceIdentity,
	type WindowLeafIdentity,
	type WindowTargetDescriptor,
	type WindowTargetKind,
} from "../model/window-target";
import type { ElectronWindowAdapter } from "../native/electron-window-adapter";
import { NativeWindowController } from "../native/native-window-controller";

export interface WindowCandidate {
	runtimeId: string;
	kind: WindowTargetKind;
	label: string;
	document: Document;
	domWindow: Window;
	leaves: readonly WindowLeafIdentity[];
}

interface ManagedWindowTarget {
	candidate: WindowCandidate;
	persistence: PersistenceIdentity;
	controller: NativeWindowController | null;
	error: string | null;
}

export type PreferenceResolver = (
	persistence: PersistenceIdentity,
) => WindowPreference | null;

export class WindowRegistry {
	private readonly targets = new Map<string, ManagedWindowTarget>();
	private readonly listeners = new Set<() => void>();
	private disposed = false;

	constructor(
		private readonly adapter: ElectronWindowAdapter,
		private readonly resolvePreference: PreferenceResolver,
	) {}

	onChange(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	get descriptors(): WindowTargetDescriptor[] {
		return [...this.targets.values()]
			.map((target) => this.toDescriptor(target))
			.sort((left, right) => {
				if (left.kind !== right.kind) {
					return left.kind === "main" ? -1 : 1;
				}
				return left.label.localeCompare(right.label);
			});
	}

	getTargetForWindow(domWindow: Window): WindowTargetDescriptor | null {
		const target = [...this.targets.values()].find(
			(candidate) => candidate.candidate.domWindow === domWindow,
		);
		return target ? this.toDescriptor(target) : null;
	}

	getController(runtimeId: string): NativeWindowController | null {
		return this.targets.get(runtimeId)?.controller ?? null;
	}

	setPreference(runtimeId: string, preference: WindowPreference): boolean {
		const applied =
			this.targets.get(runtimeId)?.controller?.setPreference(preference) ?? false;
		this.emitChange();
		return applied;
	}

	focus(runtimeId: string): boolean {
		const controller = this.targets.get(runtimeId)?.controller;
		if (!controller) {
			return false;
		}
		controller.focus();
		this.emitChange();
		return true;
	}

	restoreAll(): void {
		for (const target of this.targets.values()) {
			target.controller?.setPreference(DEFAULT_WINDOW_PREFERENCE);
		}
		this.emitChange();
	}

	reapplyPersistentPreferences(): void {
		for (const target of this.targets.values()) {
			if (!target.persistence.key) {
				continue;
			}
			const preference =
				this.resolvePreference(target.persistence) ?? DEFAULT_WINDOW_PREFERENCE;
			target.controller?.setPreference(preference);
		}
		this.emitChange();
	}

	async sync(candidates: readonly WindowCandidate[]): Promise<void> {
		if (this.disposed) {
			return;
		}

		const candidateIds = new Set(candidates.map((candidate) => candidate.runtimeId));
		for (const [runtimeId, target] of this.targets) {
			if (!candidateIds.has(runtimeId)) {
				target.controller?.dispose();
				this.targets.delete(runtimeId);
			}
		}

		const identities = candidates.map((candidate) => ({
			candidate,
			persistence: persistenceIdentity(candidate.kind, candidate.leaves),
		}));
		const counts = new Map<string, number>();
		for (const { persistence } of identities) {
			if (persistence.key?.startsWith("note:")) {
				counts.set(persistence.key, (counts.get(persistence.key) ?? 0) + 1);
			}
		}

		await Promise.all(
			identities.map(async ({ candidate, persistence }) => {
				if (this.disposed) {
					return;
				}
				if (persistence.key && (counts.get(persistence.key) ?? 0) > 1) {
					persistence = { key: null, reason: "duplicate-note" };
				}

				const existing = this.targets.get(candidate.runtimeId);
				if (existing) {
					existing.candidate = candidate;
					if (existing.persistence.key !== persistence.key) {
						existing.persistence = persistence;
						const preference = this.resolvePreference(persistence);
						if (preference) {
							existing.controller?.setPreference(preference);
						}
					}
					return;
				}

				const target: ManagedWindowTarget = {
					candidate,
					persistence,
					controller: null,
					error: null,
				};
				this.targets.set(candidate.runtimeId, target);

				try {
					const nativeWindow = await this.adapter.resolve(
						candidate.kind,
						candidate.document,
						candidate.runtimeId,
					);
					if (
						this.disposed ||
						this.targets.get(candidate.runtimeId) !== target
					) {
						return;
					}
					target.controller = new NativeWindowController(
						nativeWindow,
						candidate.document,
						() => this.emitChange(),
					);
					const preference = this.resolvePreference(persistence);
					if (preference) {
						target.controller.setPreference(preference);
					}
				} catch (error) {
					target.error = error instanceof Error ? error.message : String(error);
				}
			}),
		);

		this.emitChange();
	}

	dispose(): void {
		this.disposed = true;
		for (const target of this.targets.values()) {
			target.controller?.dispose();
		}
		this.targets.clear();
		this.listeners.clear();
	}

	private toDescriptor(target: ManagedWindowTarget): WindowTargetDescriptor {
		const controller = target.controller;
		return {
			runtimeId: target.candidate.runtimeId,
			kind: target.candidate.kind,
			label: target.candidate.label,
			focused: controller?.isFocused ?? false,
			persistence: target.persistence,
			preference: controller?.preference ?? { ...DEFAULT_WINDOW_PREFERENCE },
			supported: controller !== null,
			error: controller?.lastError ?? target.error,
		};
	}

	private emitChange(): void {
		if (this.disposed) {
			return;
		}
		for (const listener of this.listeners) {
			listener();
		}
	}
}
