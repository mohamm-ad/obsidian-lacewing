import { describe, expect, it, vi } from "vitest";
import {
	ElectronWindowAdapter,
	type ElectronRemoteSource,
	type NativeBrowserWindow,
	type NativeEventListener,
	type NativeEventName,
} from "../src/native/electron-window-adapter";
import { NativeWindowController } from "../src/native/native-window-controller";

class MockNativeWindow implements NativeBrowserWindow {
	readonly webContents = {
		executeJavaScript: vi.fn(async () => false),
	};
	readonly listeners = new Map<NativeEventName, Set<NativeEventListener>>();
	opacity = 1;
	pinned = false;
	destroyed = false;
	focused = false;
	minimized = false;
	readonly setOpacity = vi.fn((opacity: number) => {
		this.opacity = opacity;
	});
	readonly setAlwaysOnTop = vi.fn((pinned: boolean) => {
		this.pinned = pinned;
	});
	readonly focus = vi.fn(() => {
		this.focused = true;
	});
	readonly restore = vi.fn(() => {
		this.minimized = false;
	});
	readonly show = vi.fn();

	constructor(readonly id: number) {}

	getOpacity(): number {
		return this.opacity;
	}

	isAlwaysOnTop(): boolean {
		return this.pinned;
	}

	isDestroyed(): boolean {
		return this.destroyed;
	}

	isFocused(): boolean {
		return this.focused;
	}

	isMinimized(): boolean {
		return this.minimized;
	}

	on(event: NativeEventName, listener: NativeEventListener): void {
		const listeners = this.listeners.get(event) ?? new Set();
		listeners.add(listener);
		this.listeners.set(event, listeners);
	}

	removeListener(event: NativeEventName, listener: NativeEventListener): void {
		this.listeners.get(event)?.delete(listener);
	}

	emit(event: NativeEventName): void {
		for (const listener of this.listeners.get(event) ?? []) {
			listener();
		}
	}
}

function fakeDocument(): Document {
	const documentEvents = new EventTarget();
	const windowEvents = new EventTarget();
	return {
		documentElement: { dataset: {} },
		defaultView: windowEvents,
		addEventListener: documentEvents.addEventListener.bind(documentEvents),
		removeEventListener: documentEvents.removeEventListener.bind(documentEvents),
	} as unknown as Document;
}

describe("native window controller", () => {
	it("applies managed state, reapplies it, and restores the exact snapshot", () => {
		const nativeWindow = new MockNativeWindow(1);
		nativeWindow.opacity = 0.35;
		nativeWindow.pinned = true;
		const controller = new NativeWindowController(
			nativeWindow,
			fakeDocument(),
			vi.fn(),
		);

		expect(nativeWindow.setOpacity).not.toHaveBeenCalled();
		expect(controller.preference.opacity).toBe(0.5);
		expect(controller.setPreference({ opacity: 0.8, pinned: false })).toBe(true);
		nativeWindow.opacity = 1;
		nativeWindow.emit("focus");
		expect(nativeWindow.opacity).toBe(0.8);

		controller.dispose();
		expect(nativeWindow.opacity).toBe(0.35);
		expect(nativeWindow.pinned).toBe(true);
		expect(nativeWindow.listeners.get("focus")?.size).toBe(0);
	});

	it("fails safely after the native window is destroyed", () => {
		const nativeWindow = new MockNativeWindow(2);
		const controller = new NativeWindowController(
			nativeWindow,
			fakeDocument(),
			vi.fn(),
		);
		nativeWindow.destroyed = true;

		expect(controller.setPreference({ opacity: 0.7, pinned: true })).toBe(false);
		expect(controller.lastError).toMatch(/closed/u);
		expect(() => controller.dispose()).not.toThrow();
	});
});

describe("electron window adapter", () => {
	it("resolves the current main window directly", async () => {
		const nativeWindow = new MockNativeWindow(1);
		const remote: ElectronRemoteSource = {
			BrowserWindow: { getAllWindows: () => [nativeWindow] },
			getCurrentWindow: () => nativeWindow,
		};
		const adapter = new ElectronWindowAdapter(remote, vi.fn(async () => {}));

		await expect(
			adapter.resolve("main", fakeDocument(), "main"),
		).resolves.toBe(nativeWindow);
	});

	it("retries pop-out resolution and always removes its DOM marker", async () => {
		const nativeWindow = new MockNativeWindow(2);
		nativeWindow.webContents.executeJavaScript
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(true);
		const remote: ElectronRemoteSource = {
			BrowserWindow: { getAllWindows: () => [nativeWindow] },
			getCurrentWindow: () => nativeWindow,
		};
		const wait = vi.fn(async () => {});
		const document = fakeDocument();
		const adapter = new ElectronWindowAdapter(remote, wait);

		await expect(
			adapter.resolve("popout", document, "popout-1", 2),
		).resolves.toBe(nativeWindow);
		expect(wait).toHaveBeenCalledOnce();
		expect(document.documentElement.dataset.windowOverlayId).toBeUndefined();
	});

	it("reports unsupported pop-outs without leaving a marker", async () => {
		const nativeWindow = new MockNativeWindow(3);
		const remote: ElectronRemoteSource = {
			BrowserWindow: { getAllWindows: () => [nativeWindow] },
			getCurrentWindow: () => nativeWindow,
		};
		const document = fakeDocument();
		const adapter = new ElectronWindowAdapter(remote, vi.fn(async () => {}));

		await expect(
			adapter.resolve("popout", document, "missing", 1),
		).rejects.toThrow(/could not be resolved/u);
		expect(document.documentElement.dataset.windowOverlayId).toBeUndefined();
	});
});
