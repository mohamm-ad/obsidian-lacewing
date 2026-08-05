import type { WindowTargetKind } from "../model/window-target";

export type NativeEventName =
	| "always-on-top-changed"
	| "blur"
	| "closed"
	| "focus"
	| "restore"
	| "show";

export type NativeEventListener = (...args: unknown[]) => void;

export interface NativeWebContents {
	executeJavaScript(script: string): Promise<unknown>;
}

export interface NativeBrowserWindow {
	id: number;
	webContents: NativeWebContents;
	focus(): void;
	getOpacity(): number;
	isAlwaysOnTop(): boolean;
	isDestroyed(): boolean;
	isFocused(): boolean;
	isMinimized(): boolean;
	on(event: NativeEventName, listener: NativeEventListener): void;
	removeListener(event: NativeEventName, listener: NativeEventListener): void;
	restore(): void;
	setAlwaysOnTop(flag: boolean, level?: "floating" | "normal"): void;
	setOpacity(opacity: number): void;
	show(): void;
}

export interface ElectronRemoteSource {
	BrowserWindow: {
		getAllWindows(): NativeBrowserWindow[];
	};
	getCurrentWindow(): NativeBrowserWindow;
}

type WindowWithRequire = Window & {
	require?: (moduleName: string) => unknown;
};

const DEFAULT_RESOLUTION_ATTEMPTS = 20;
const DEFAULT_RESOLUTION_DELAY_MS = 50;

function delay(milliseconds: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export class ElectronWindowAdapter {
	constructor(
		private readonly remote: ElectronRemoteSource,
		private readonly wait: (milliseconds: number) => Promise<void> = delay,
	) {}

	static fromRuntime(): ElectronWindowAdapter | null {
		try {
			const requireModule = (window as WindowWithRequire).require;
			if (!requireModule) {
				return null;
			}

			const remote = requireModule("@electron/remote") as ElectronRemoteSource;
			if (!remote?.BrowserWindow?.getAllWindows || !remote.getCurrentWindow) {
				return null;
			}

			return new ElectronWindowAdapter(remote);
		} catch {
			return null;
		}
	}

	async resolve(
		kind: WindowTargetKind,
		document: Document,
		runtimeId: string,
		attempts = DEFAULT_RESOLUTION_ATTEMPTS,
	): Promise<NativeBrowserWindow> {
		if (kind === "main") {
			const mainWindow = this.remote.getCurrentWindow();
			if (!mainWindow || mainWindow.isDestroyed()) {
				throw new Error("The main Obsidian window is unavailable.");
			}
			return mainWindow;
		}

		const marker = `window-overlay-${runtimeId}-${crypto.randomUUID()}`;
		document.documentElement.dataset.windowOverlayId = marker;
		const markerLiteral = JSON.stringify(marker);
		const script =
			`document.documentElement.dataset.windowOverlayId === ${markerLiteral}`;

		try {
			for (let attempt = 0; attempt < attempts; attempt += 1) {
				for (const nativeWindow of this.remote.BrowserWindow.getAllWindows()) {
					if (nativeWindow.isDestroyed()) {
						continue;
					}

					try {
						if ((await nativeWindow.webContents.executeJavaScript(script)) === true) {
							return nativeWindow;
						}
					} catch {
						// A window may close while resolution is in flight.
					}
				}

				await this.wait(DEFAULT_RESOLUTION_DELAY_MS);
			}
		} finally {
			delete document.documentElement.dataset.windowOverlayId;
		}

		throw new Error("The native pop-out window could not be resolved.");
	}
}
