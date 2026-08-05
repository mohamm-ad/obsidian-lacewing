import type { ContrastShieldLevel } from "../model/settings";

const DATASET_KEY = "windowOverlayContrastShield";

export class ContrastShieldController {
	private readonly originalMarker: string | undefined;
	private current: ContrastShieldLevel = "none";

	constructor(private readonly document: Document) {
		this.originalMarker = document.documentElement.dataset[DATASET_KEY];
	}

	get level(): ContrastShieldLevel {
		return this.current;
	}

	set(level: ContrastShieldLevel): boolean {
		try {
			this.current = level;
			if (level === "none") {
				delete this.document.documentElement.dataset[DATASET_KEY];
			} else {
				this.document.documentElement.dataset[DATASET_KEY] = level;
			}
			return true;
		} catch {
			return false;
		}
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
