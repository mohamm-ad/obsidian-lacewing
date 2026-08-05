import { describe, expect, it, vi } from "vitest";
import type { ElectronWindowAdapter, NativeBrowserWindow, NativeEventListener, NativeEventName } from "../src/native/electron-window-adapter";
import { WindowRegistry, type WindowCandidate } from "../src/windows/window-registry";

class RegistryNativeWindow implements NativeBrowserWindow {
	readonly webContents = { executeJavaScript: vi.fn(async () => true) };
	readonly listeners = new Map<NativeEventName, Set<NativeEventListener>>();
	opacity = 1;
	pinned = false;
	destroyed = false;
	focused = false;
	readonly setOpacity = vi.fn((opacity: number) => {
		this.opacity = opacity;
	});
	readonly setAlwaysOnTop = vi.fn((pinned: boolean) => {
		this.pinned = pinned;
	});
	readonly focus = vi.fn(() => {
		this.focused = true;
	});
	readonly restore = vi.fn();
	readonly show = vi.fn();

	constructor(readonly id: number) {}
	getOpacity(): number { return this.opacity; }
	isAlwaysOnTop(): boolean { return this.pinned; }
	isDestroyed(): boolean { return this.destroyed; }
	isFocused(): boolean { return this.focused; }
	isMinimized(): boolean { return false; }
	on(event: NativeEventName, listener: NativeEventListener): void {
		const listeners = this.listeners.get(event) ?? new Set();
		listeners.add(listener);
		this.listeners.set(event, listeners);
	}
	removeListener(event: NativeEventName, listener: NativeEventListener): void {
		this.listeners.get(event)?.delete(listener);
	}
}

function candidate(
	runtimeId: string,
	kind: "main" | "popout",
	leaves: WindowCandidate["leaves"],
): WindowCandidate {
	const documentEvents = new EventTarget();
	const windowEvents = new EventTarget();
	const document = {
		documentElement: { dataset: {} },
		defaultView: windowEvents,
		addEventListener: documentEvents.addEventListener.bind(documentEvents),
		removeEventListener: documentEvents.removeEventListener.bind(documentEvents),
	} as unknown as Document;
	return {
		runtimeId,
		kind,
		label: runtimeId,
		document,
		domWindow: windowEvents as unknown as Window,
		leaves,
	};
}

describe("window registry", () => {
	it("classifies duplicate note windows as session-only", async () => {
		const nativeWindows = new Map([
			["one", new RegistryNativeWindow(1)],
			["two", new RegistryNativeWindow(2)],
		]);
		const adapter = {
			resolve: vi.fn(async (_kind, _document, runtimeId: string) => {
				const nativeWindow = nativeWindows.get(runtimeId);
				if (!nativeWindow) throw new Error("Missing test window");
				return nativeWindow;
			}),
		} as unknown as ElectronWindowAdapter;
		const registry = new WindowRegistry(adapter, () => null);

		await registry.sync([
			candidate("one", "popout", [{ type: "markdown", filePath: "Call.md" }]),
			candidate("two", "popout", [{ type: "markdown", filePath: "Call.md" }]),
		]);

		expect(registry.descriptors.map((item) => item.persistence)).toEqual([
			{ key: null, reason: "duplicate-note" },
			{ key: null, reason: "duplicate-note" },
		]);
	});

	it("applies saved preferences and restores adopted windows on cleanup", async () => {
		const nativeWindow = new RegistryNativeWindow(3);
		const adapter = {
			resolve: vi.fn(async () => nativeWindow),
		} as unknown as ElectronWindowAdapter;
		const registry = new WindowRegistry(adapter, (identity) =>
			identity.key === "main" ? { opacity: 0.75, pinned: true } : null,
		);

		await registry.sync([candidate("main", "main", [])]);
		expect(nativeWindow.opacity).toBe(0.75);
		expect(nativeWindow.pinned).toBe(true);

		await registry.sync([]);
		expect(nativeWindow.opacity).toBe(1);
		expect(nativeWindow.pinned).toBe(false);
		expect(registry.descriptors).toEqual([]);
	});

	it("keeps unsupported native windows visible in the manager model", async () => {
		const adapter = {
			resolve: vi.fn(async () => {
				throw new Error("Electron is unavailable");
			}),
		} as unknown as ElectronWindowAdapter;
		const registry = new WindowRegistry(adapter, () => null);

		await registry.sync([candidate("main", "main", [])]);
		expect(registry.descriptors[0]).toMatchObject({
			supported: false,
			error: "Electron is unavailable",
		});
	});

	it("applies resolved smart fade behavior to newly adopted windows", async () => {
		const nativeWindow = new RegistryNativeWindow(5);
		const adapter = {
			resolve: vi.fn(async () => nativeWindow),
		} as unknown as ElectronWindowAdapter;
		const registry = new WindowRegistry(
			adapter,
			() => null,
			() => ({
				enabled: true,
				activeOpacity: 0.9,
				idleOpacity: 0.65,
				idleDelayMs: 1_000,
				fadeOnBlur: true,
				fadeOnInactivity: true,
				brightenOnKeyboard: true,
				brightenOnPointer: true,
				transitionDurationMs: 0,
				respectReducedMotion: true,
			}),
		);

		await registry.sync([candidate("main", "main", [])]);
		expect(nativeWindow.opacity).toBe(0.65);
		registry.dispose();
		expect(nativeWindow.opacity).toBe(1);
	});

	it("refreshes smart fade after global defaults change", async () => {
		const nativeWindow = new RegistryNativeWindow(6);
		const adapter = {
			resolve: vi.fn(async () => nativeWindow),
		} as unknown as ElectronWindowAdapter;
		let idleOpacity = 0.65;
		const registry = new WindowRegistry(
			adapter,
			() => null,
			() => ({
				enabled: true,
				activeOpacity: 0.9,
				idleOpacity,
				idleDelayMs: 1_000,
				fadeOnBlur: true,
				fadeOnInactivity: true,
				brightenOnKeyboard: true,
				brightenOnPointer: true,
				transitionDurationMs: 0,
				respectReducedMotion: true,
			}),
		);

		await registry.sync([candidate("main", "main", [])]);
		expect(nativeWindow.opacity).toBe(0.65);
		idleOpacity = 0.55;
		registry.refreshSmartFade();
		expect(nativeWindow.opacity).toBe(0.55);
	});

	it("applies a session-only smart fade override directly", async () => {
		const nativeWindow = new RegistryNativeWindow(7);
		const adapter = {
			resolve: vi.fn(async () => nativeWindow),
		} as unknown as ElectronWindowAdapter;
		const registry = new WindowRegistry(adapter, () => null);

		await registry.sync([
			candidate("mixed", "popout", [
				{ type: "markdown", filePath: "One.md" },
				{ type: "markdown", filePath: "Two.md" },
			]),
		]);
		expect(
			registry.setSmartFade("mixed", {
				enabled: true,
				activeOpacity: 0.9,
				idleOpacity: 0.55,
				idleDelayMs: 1_000,
				fadeOnBlur: true,
				fadeOnInactivity: true,
				brightenOnKeyboard: true,
				brightenOnPointer: true,
				transitionDurationMs: 0,
				respectReducedMotion: true,
			}),
		).toBe(true);
		expect(nativeWindow.opacity).toBe(0.55);
		expect(registry.descriptors[0]?.persistence.key).toBeNull();
		expect(registry.descriptors[0]?.smartFade.enabled).toBe(true);
	});

	it("applies, refreshes, and removes contrast shield markers", async () => {
		const nativeWindow = new RegistryNativeWindow(8);
		const adapter = {
			resolve: vi.fn(async () => nativeWindow),
		} as unknown as ElectronWindowAdapter;
		let shield: "medium" | "strong" = "medium";
		const main = candidate("main", "main", []);
		const registry = new WindowRegistry(
			adapter,
			() => null,
			undefined,
			() => shield,
		);

		await registry.sync([main]);
		expect(
			main.document.documentElement.dataset.windowOverlayContrastShield,
		).toBe("medium");
		expect(registry.descriptors[0]?.contrastShield).toBe("medium");

		shield = "strong";
		registry.refreshContrastShield();
		expect(
			main.document.documentElement.dataset.windowOverlayContrastShield,
		).toBe("strong");
		await registry.sync([]);
		expect(
			main.document.documentElement.dataset.windowOverlayContrastShield,
		).toBeUndefined();
	});

	it("does not adopt a window when resolution finishes after disposal", async () => {
		const nativeWindow = new RegistryNativeWindow(4);
		let finishResolution!: (value: NativeBrowserWindow) => void;
		const resolution = new Promise<NativeBrowserWindow>((resolve) => {
			finishResolution = resolve;
		});
		const adapter = {
			resolve: vi.fn(async () => await resolution),
		} as unknown as ElectronWindowAdapter;
		const registry = new WindowRegistry(adapter, () => ({
			opacity: 0.7,
			pinned: true,
		}));

		const sync = registry.sync([candidate("main", "main", [])]);
		registry.dispose();
		finishResolution(nativeWindow);
		await sync;

		expect(registry.descriptors).toEqual([]);
		expect(nativeWindow.setOpacity).not.toHaveBeenCalled();
		expect(nativeWindow.listeners.size).toBe(0);
	});
});
