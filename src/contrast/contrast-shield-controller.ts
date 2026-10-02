import type { ContrastShieldLevel } from "../model/settings";

const DATASET_KEY = "windowOverlayContrastShield";

export class ContrastShieldController {
	private readonly originalMarker: string | undefined;
	private current: ContrastShieldLevel = "none";
	private paused = false;

	constructor(private readonly document: Document) {
		this.originalMarker = document.documentElement.dataset[DATASET_KEY];
	}

	get level(): ContrastShieldLevel {
		return this.current;
	}

	set(level: ContrastShieldLevel): boolean {
		try {
			this.current = level;
			if (this.paused || level === "none") {
				delete this.document.documentElement.dataset[DATASET_KEY];
			} else {
				this.document.documentElement.dataset[DATASET_KEY] = level;
			}
			return true;
		} catch {
			return false;
		}
	}

	setPaused(paused: boolean): boolean {
		this.paused = paused;
		return this.set(this.current);
	}

	dispose(): void {
		try {
			if (this.originalMarker === undefined) {
				delete this.document.documentElement.dataset[DATASET_KEY];
			} else {
				this.document.documentElement.dataset[DATASET_KEY] =
					this.originalMarker;
			}
		} catch {
			// Window teardown may remove the document before plugin disposal.
		}
	}
}
