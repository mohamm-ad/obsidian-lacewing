import { Modal, Notice, Setting } from "obsidian";
import type { App } from "obsidian";
import {
	cloneWindowPreference,
	isSmartFadeTrigger,
	opacityPercent,
	smartFadeTrigger,
	smartFadeTriggerOverrides,
	type SmartFadeOverrides,
	type SmartFadeSettings,
	type WindowPreference,
} from "../model/settings";
import type {
	PersistenceIdentity,
	WindowTargetDescriptor,
} from "../model/window-target";
import type { WindowRegistry } from "../windows/window-registry";
import {
	clearSmartFadeOverrides,
	persistenceLabel,
	resetWindowPreference,
	smartFadeStatus,
	updateSmartFadeOverrides,
	updateWindowPreference,
} from "./window-manager-model";

export interface WindowManagerActions {
	isSaved(identity: PersistenceIdentity): boolean;
	setPreference(
		descriptor: WindowTargetDescriptor,
		preference: WindowPreference,
	): boolean;
	resolveSmartFade(
		descriptor: WindowTargetDescriptor,
		preference: WindowPreference,
	): SmartFadeSettings;
	reset(descriptor: WindowTargetDescriptor): void;
}

export class WindowManagerModal extends Modal {
	private unsubscribe: (() => void) | null = null;
	private suppressRefresh = false;
	private readonly openSmartFade = new Set<string>();

	constructor(
		app: App,
		private readonly registry: WindowRegistry,
		private readonly actions: WindowManagerActions,
	) {
		super(app);
	}

	override onOpen(): void {
		this.setTitle("Window overlay");
		this.modalEl.addClass("window-overlay-modal");
		this.unsubscribe = this.registry.onChange(() => {
			if (!this.suppressRefresh) {
				this.render();
			}
		});
		this.render();
	}

	override onClose(): void {
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.contentEl.empty();
	}

	private render(): void {
		this.contentEl.empty();
		this.contentEl.addClass("window-overlay-manager");
		this.contentEl.createEl("p", {
			cls: "window-overlay-intro",
			text: "Adjust each Obsidian window independently. Changes apply immediately.",
		});

		const descriptors = this.registry.descriptors;
		if (descriptors.length === 0) {
			this.contentEl.createEl("p", {
				cls: "window-overlay-empty",
				text: "No vault views are available yet.",
			});
			return;
		}

		for (const descriptor of descriptors) {
			this.renderWindow(descriptor);
		}
	}

	private renderWindow(descriptor: WindowTargetDescriptor): void {
		const card = this.contentEl.createDiv("window-overlay-card");
		const header = card.createDiv("window-overlay-card-header");
		const titleGroup = header.createDiv("window-overlay-title-group");
		titleGroup.createEl("h3", { text: descriptor.label });
		const badges = titleGroup.createDiv("window-overlay-badges");
		badges.createSpan({
			cls: "window-overlay-badge",
			text: descriptor.kind === "main" ? "Main" : "Pop-out",
		});
		if (descriptor.focused) {
			badges.createSpan({
				cls: "window-overlay-badge is-focused",
				text: "Focused",
			});
		}
		if (descriptor.smartFade.enabled) {
			badges.createSpan({
				cls: "window-overlay-badge is-smart-fade",
				text: descriptor.smartFadeState === "active" ? "Active" : "Idle",
			});
		}

		const status = persistenceLabel(
			descriptor.persistence,
			this.actions.isSaved(descriptor.persistence),
		);
		const statusEl = card.createDiv({
			cls: "window-overlay-status",
			text: status,
		});

		let current = cloneWindowPreference(descriptor.preference);
		new Setting(card)
			.setName("Fixed opacity")
			.setDesc("Used whenever smart fade is off for this window.")
			.setDisabled(!descriptor.supported)
			.addSlider((slider) => {
				slider
					.setDisabled(!descriptor.supported)
					.setLimits(50, 100, 5)
					.setValue(opacityPercent(current.opacity))
					.setInstant(true)
					.setDisplayFormat((value) => `${value}%`)
					.onChange((value) => {
						current = updateWindowPreference(current, {
							opacity: value / 100,
						});
						this.applyFromControl(descriptor, current);
						statusEl.setText(
							persistenceLabel(
								descriptor.persistence,
								this.actions.isSaved(descriptor.persistence),
							),
						);
					});
			});

		this.renderSmartFade(
			card,
			descriptor,
			() => current,
			(preference) => {
				current = preference;
			},
			statusEl,
		);

		new Setting(card)
			.setName("Always on top")
			.setDesc("Keep this window above other apps on macOS.")
			.setDisabled(!descriptor.supported)
			.addToggle((toggle) => {
				toggle
					.setDisabled(!descriptor.supported)
					.setValue(current.pinned)
					.onChange((pinned) => {
					current = updateWindowPreference(current, { pinned });
					this.applyFromControl(descriptor, current);
					statusEl.setText(
						persistenceLabel(
							descriptor.persistence,
							this.actions.isSaved(descriptor.persistence),
						),
					);
					});
			});

		new Setting(card)
			.setName("Window actions")
			.setDesc("Bring this window forward or return it to safe defaults.")
			.setDisabled(!descriptor.supported)
			.addButton((button) =>
				button
					.setDisabled(!descriptor.supported)
					.setButtonText("Focus")
					.onClick(() => {
						this.registry.focus(descriptor.runtimeId);
					}),
			)
			.addButton((button) =>
				button
					.setDisabled(!descriptor.supported)
					.setButtonText("Reset")
					.onClick(() => {
						current = resetWindowPreference();
						this.runWithoutRefresh(() => this.actions.reset(descriptor));
						this.render();
					}),
			);

		if (descriptor.error) {
			card.createDiv({
				cls: "window-overlay-error",
				text: descriptor.error,
			});
		}
	}

	private renderSmartFade(
		card: HTMLElement,
		descriptor: WindowTargetDescriptor,
		getCurrent: () => WindowPreference,
		setCurrent: (preference: WindowPreference) => void,
		statusEl: HTMLElement,
	): void {
		const details = card.createEl("details", {
			cls: "window-overlay-smart-fade",
		});
		details.open =
			this.openSmartFade.has(descriptor.runtimeId) ||
			descriptor.preference.smartFade !== undefined;
		details.addEventListener("toggle", () => {
			if (details.open) {
				this.openSmartFade.add(descriptor.runtimeId);
			} else {
				this.openSmartFade.delete(descriptor.runtimeId);
			}
		});

		const summary = details.createEl("summary");
		summary.createSpan({ text: "Smart fade" });
		const statusValue = summary.createSpan({
			cls: "window-overlay-smart-fade-status",
			text: smartFadeStatus(descriptor.smartFade, descriptor.smartFadeState),
		});
		const body = details.createDiv("window-overlay-smart-fade-body");
		let effective = { ...descriptor.smartFade };

		const applyPatch = (patch: SmartFadeOverrides): void => {
			const current = updateSmartFadeOverrides(getCurrent(), patch);
			setCurrent(current);
			effective = this.actions.resolveSmartFade(descriptor, current);
			this.applyFromControl(descriptor, current);
			statusValue.setText(
				smartFadeStatus(effective, descriptor.smartFadeState),
			);
			this.updatePersistenceStatus(descriptor, statusEl);
		};

		const mode = getCurrent().smartFade?.enabled;
		new Setting(body)
			.setName("Smart fade")
			.setDesc("Follow the global on/off setting or choose one for this window.")
			.setDisabled(!descriptor.supported)
			.addDropdown((dropdown) => {
				dropdown
					.setDisabled(!descriptor.supported)
					.addOptions({
						inherit: "Use global setting",
						enabled: "On for this window",
						disabled: "Off for this window",
					})
					.setValue(
						mode === undefined ? "inherit" : mode ? "enabled" : "disabled",
					)
					.onChange((value) => {
						applyPatch({
							enabled:
								value === "inherit" ? undefined : value === "enabled",
						});
						this.openSmartFade.add(descriptor.runtimeId);
						this.render();
					});
			});

		if (effective.enabled) {
			this.renderSmartFadeOpacity(
				body,
				"Active opacity",
				"Readable opacity while using or reading this window.",
				effective.activeOpacity,
				opacityPercent(effective.idleOpacity),
				100,
				(value) => applyPatch({ activeOpacity: value / 100 }),
				descriptor.supported,
			);
			this.renderSmartFadeOpacity(
				body,
				"Idle opacity",
				"See-through opacity used when the selected trigger fades this window.",
				effective.idleOpacity,
				50,
				opacityPercent(effective.activeOpacity),
				(value) => applyPatch({ idleOpacity: value / 100 }),
				descriptor.supported,
			);

			new Setting(body)
				.setName("Fade trigger")
				.setDesc("Focus loss only keeps this window bright while you read it.")
				.setDisabled(!descriptor.supported)
				.addDropdown((dropdown) => {
					dropdown
						.setDisabled(!descriptor.supported)
						.addOptions({
							"inactivity-and-focus-loss": "Inactivity and focus loss",
							"focus-loss-only": "Focus loss only",
							"inactivity-only": "Inactivity only",
						})
						.setValue(smartFadeTrigger(effective))
						.onChange((value) => {
							if (isSmartFadeTrigger(value)) {
								applyPatch(smartFadeTriggerOverrides(value));
								this.openSmartFade.add(descriptor.runtimeId);
								this.render();
							}
						});
				});

			if (effective.fadeOnInactivity) {
				new Setting(body)
					.setName("Idle delay")
					.setDesc("How long to wait after the last reading or editing activity.")
					.setDisabled(!descriptor.supported)
					.addSlider((slider) => {
						slider
							.setDisabled(!descriptor.supported)
							.setLimits(250, 10_000, 250)
							.setValue(effective.idleDelayMs)
							.setInstant(true)
							.setDisplayFormat((value) => this.formatDelay(value))
							.onChange((value) => applyPatch({ idleDelayMs: value }));
					});

				this.renderSmartFadeToggle(
					body,
					"Brighten on keyboard activity",
					"Typing and navigation keys, including arrows and Page Up or Down, count as activity.",
					effective.brightenOnKeyboard,
					(value) => applyPatch({ brightenOnKeyboard: value }),
					descriptor.supported,
				);
				this.renderSmartFadeToggle(
					body,
					"Brighten on pointer and scroll activity",
					"Clicking or scrolling with a mouse, trackpad, or scrollbar counts as activity.",
					effective.brightenOnPointer,
					(value) => applyPatch({ brightenOnPointer: value }),
					descriptor.supported,
				);
			}
		}

		new Setting(body)
			.setName("Window overrides")
			.setDesc("Remove custom values and follow all global smart fade settings.")
			.setDisabled(
				!descriptor.supported || getCurrent().smartFade === undefined,
			)
			.addButton((button) =>
				button
					.setButtonText("Use global settings")
					.setDisabled(
						!descriptor.supported || getCurrent().smartFade === undefined,
					)
					.onClick(() => {
						const current = clearSmartFadeOverrides(getCurrent());
						setCurrent(current);
						this.applyFromControl(descriptor, current);
						this.openSmartFade.add(descriptor.runtimeId);
						this.render();
					}),
			);
	}

	private renderSmartFadeOpacity(
		container: HTMLElement,
		name: string,
		description: string,
		value: number,
		minimum: number,
		maximum: number,
		onChange: (value: number) => void,
		supported: boolean,
	): void {
		new Setting(container)
			.setName(name)
			.setDesc(description)
			.setDisabled(!supported)
			.addSlider((slider) => {
				slider
					.setDisabled(!supported)
					.setLimits(minimum, maximum, 1)
					.setValue(opacityPercent(value))
					.setInstant(true)
					.setDisplayFormat((opacity) => `${opacity}%`)
					.onChange(onChange);
			});
	}

	private renderSmartFadeToggle(
		container: HTMLElement,
		name: string,
		description: string,
		value: boolean,
		onChange: (value: boolean) => void,
		supported: boolean,
	): void {
		new Setting(container)
			.setName(name)
			.setDesc(description)
			.setDisabled(!supported)
			.addToggle((toggle) =>
				toggle
					.setDisabled(!supported)
					.setValue(value)
					.onChange(onChange),
			);
	}

	private updatePersistenceStatus(
		descriptor: WindowTargetDescriptor,
		statusEl: HTMLElement,
	): void {
		statusEl.setText(
			persistenceLabel(
				descriptor.persistence,
				this.actions.isSaved(descriptor.persistence),
			),
		);
	}

	private formatDelay(milliseconds: number): string {
		const seconds = milliseconds / 1_000;
		return `${seconds.toFixed(Number.isInteger(seconds) ? 0 : 2)} s`;
	}

	private applyFromControl(
		descriptor: WindowTargetDescriptor,
		preference: WindowPreference,
	): void {
		let applied = false;
		this.runWithoutRefresh(() => {
			applied = this.actions.setPreference(descriptor, preference);
		});
		if (!applied) {
			new Notice("Window overlay could not update this window.");
		}
	}

	private runWithoutRefresh(callback: () => void): void {
		this.suppressRefresh = true;
		try {
			callback();
		} finally {
			this.suppressRefresh = false;
		}
	}
}
