export class OverlaySessionTracker {
	private readonly windowsByPath = new Map<string, Window>();

	get(path: string): Window | null {
		const domWindow = this.windowsByPath.get(path);
		if (!domWindow) {
			return null;
		}
		if (domWindow.closed) {
			this.windowsByPath.delete(path);
			return null;
		}
		return domWindow;
	}

	track(path: string, domWindow: Window): void {
		this.windowsByPath.set(path, domWindow);
	}

	forgetWindow(domWindow: Window): void {
		for (const [path, trackedWindow] of this.windowsByPath) {
			if (trackedWindow === domWindow) {
				this.windowsByPath.delete(path);
			}
		}
	}

	migratePath(oldPath: string, newPath: string): void {
		for (const [path, domWindow] of [...this.windowsByPath]) {
			if (path === oldPath || path.startsWith(`${oldPath}/`)) {
				const migratedPath = `${newPath}${path.slice(oldPath.length)}`;
				if (!this.windowsByPath.has(migratedPath)) {
					this.windowsByPath.set(migratedPath, domWindow);
				}
				this.windowsByPath.delete(path);
			}
		}
	}

	removePath(path: string): void {
		for (const trackedPath of [...this.windowsByPath.keys()]) {
			if (trackedPath === path || trackedPath.startsWith(`${path}/`)) {
				this.windowsByPath.delete(trackedPath);
			}
		}
	}

	clear(): void {
		this.windowsByPath.clear();
	}
}
