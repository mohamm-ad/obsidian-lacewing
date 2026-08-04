import type { App, MarkdownView, WorkspaceContainer } from "obsidian";
import type { WindowLeafIdentity } from "../model/window-target";
import type { WindowCandidate } from "./window-registry";

interface CandidateGroup {
	container: WorkspaceContainer;
	leaves: WindowLeafIdentity[];
}

export class ObsidianWindowSource {
	private readonly popoutIds = new WeakMap<Window, string>();
	private nextPopoutId = 1;

	constructor(private readonly app: App) {}

	discover(): WindowCandidate[] {
		const groups = new Map<WorkspaceContainer, CandidateGroup>();
		this.app.workspace.iterateAllLeaves((leaf) => {
			const container = leaf.getContainer();
			const group = groups.get(container) ?? { container, leaves: [] };
			const type = leaf.view.getViewType();
			const markdownView = leaf.view as MarkdownView;
			group.leaves.push({
				type,
				filePath: type === "markdown" ? (markdownView.file?.path ?? null) : null,
			});
			groups.set(container, group);
		});

		const candidates: WindowCandidate[] = [];
		for (const { container, leaves } of groups.values()) {
			const main = container === this.app.workspace.rootSplit;
			const runtimeId = main ? "main" : this.getPopoutId(container.win);
			candidates.push({
				runtimeId,
				kind: main ? "main" : "popout",
				label: main ? `Main — ${this.app.vault.getName()}` : this.popoutLabel(leaves, container.doc),
				document: container.doc,
				domWindow: container.win,
				leaves,
			});
		}

		return candidates;
	}

	private getPopoutId(domWindow: Window): string {
		let id = this.popoutIds.get(domWindow);
		if (!id) {
			id = `popout-${this.nextPopoutId}`;
			this.nextPopoutId += 1;
			this.popoutIds.set(domWindow, id);
		}
		return id;
	}

	private popoutLabel(
		leaves: readonly WindowLeafIdentity[],
		document: Document,
	): string {
		if (leaves.length === 1 && leaves[0]?.filePath) {
			return leaves[0].filePath.split("/").at(-1)?.replace(/\.md$/u, "") ?? "Pop-out";
		}

		return document.title || "Pop-out";
	}
}

