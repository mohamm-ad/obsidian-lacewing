import { Modal, Notice, Setting } from "obsidian";
import type { App } from "obsidian";
import { opacityPercent, type WindowPreference } from "../model/settings";
import type {
	PersistenceIdentity,
	WindowTargetDescriptor,
} from "../model/window-target";
import type { WindowRegistry } from "../windows/window-registry";
import {
	persistenceLabel,
	resetWindowPreference,
	updateWindowPreference,
} from "./window-manager-model";

export interface WindowManagerActions {
	isSaved(identity: PersistenceIdentity): boolean;
	setPreference(
		descriptor: WindowTargetDescriptor,
		preference: WindowPreference,
	): boolean;
	reset(descriptor: WindowTargetDescriptor): void;
}

export class WindowManagerModal extends Modal {
	private unsubscribe: (() => void) | null = null;
	private suppressRefresh = false;

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

		const status = persistenceLabel(
			descriptor.persistence,
			this.actions.isSaved(descriptor.persistence),
		);
		const statusEl = card.createDiv({
			cls: "window-overlay-status",
			text: status,
		});

		let current = { ...descriptor.preference };
		new Setting(card)
			.setName("Opacity")
			.setDesc("Set whole-window opacity from 50% to 100%.")
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
