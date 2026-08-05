import { describe, expect, it, vi } from "vitest";
import {
	ElectronWindowAdapter,
	type ElectronRemoteSource,
	type NativeBrowserWindow,
	type NativeEventListener,
	type NativeEventName,
} from "../src/native/electron-window-adapter";
import { NativeWindowController } from "../src/native/native-window-controller";
import { DEFAULT_SMART_FADE_SETTINGS } from "../src/model/settings";

const timerHost = {
	setTimeout: (callback: () => void, milliseconds: number) =>
		globalThis.setTimeout(callback, milliseconds) as unknown as number,
	clearTimeout: (timer: number) => globalThis.clearTimeout(timer),
};

const INSTANT_SMART_FADE_SETTINGS = {
	...DEFAULT_SMART_FADE_SETTINGS,
	transitionDurationMs: 0,
};

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

function fakeDocument(prefersReducedMotion = false): Document {
	const documentEvents = new EventTarget();
	const windowEvents = Object.assign(new EventTarget(), {
		matchMedia: vi.fn(() => ({ matches: prefersReducedMotion })),
	});
	return {
		documentElement: { dataset: {} },
		defaultView: windowEvents,
		addEventListener: documentEvents.addEventListener.bind(documentEvents),
		removeEventListener: documentEvents.removeEventListener.bind(documentEvents),
		dispatchEvent: documentEvents.dispatchEvent.bind(documentEvents),
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

	it("fades on idle and brightens on keyboard activity", async () => {
		vi.useFakeTimers();
		const nativeWindow = new MockNativeWindow(5);
		nativeWindow.focused = true;
		const document = fakeDocument();
		const controller = new NativeWindowController(
			nativeWindow,
			document,
			vi.fn(),
			timerHost,
		);
		controller.setSmartFade({
			...INSTANT_SMART_FADE_SETTINGS,
			enabled: true,
			activeOpacity: 0.9,
			idleOpacity: 0.6,
			idleDelayMs: 500,
		});

		expect(nativeWindow.opacity).toBe(0.9);
		await vi.advanceTimersByTimeAsync(500);
		expect(nativeWindow.opacity).toBe(0.6);
		document.dispatchEvent(new Event("keydown"));
		expect(nativeWindow.opacity).toBe(0.9);
		controller.dispose();
		vi.useRealTimers();
	});

	it("fades immediately on native blur and restores on focus", () => {
		const nativeWindow = new MockNativeWindow(6);
		nativeWindow.focused = true;
		const controller = new NativeWindowController(
			nativeWindow,
			fakeDocument(),
			vi.fn(),
			timerHost,
		);
		controller.setSmartFade({
			...INSTANT_SMART_FADE_SETTINGS,
			enabled: true,
		});

		nativeWindow.focused = false;
		nativeWindow.emit("blur");
		expect(nativeWindow.opacity).toBe(0.6);
		nativeWindow.focused = true;
		nativeWindow.emit("focus");
		expect(nativeWindow.opacity).toBe(0.92);
		controller.dispose();
	});

	it("honors disabled keyboard and pointer brighten triggers", async () => {
		vi.useFakeTimers();
		const nativeWindow = new MockNativeWindow(8);
		nativeWindow.focused = true;
		const document = fakeDocument();
		const controller = new NativeWindowController(
			nativeWindow,
			document,
			vi.fn(),
			timerHost,
		);
		controller.setSmartFade({
			...INSTANT_SMART_FADE_SETTINGS,
			enabled: true,
			idleDelayMs: 250,
			brightenOnKeyboard: false,
			brightenOnPointer: false,
		});
		await vi.advanceTimersByTimeAsync(250);
		expect(nativeWindow.opacity).toBe(0.6);

		document.dispatchEvent(new Event("keydown"));
		document.dispatchEvent(new Event("pointerdown"));
		document.dispatchEvent(new Event("wheel"));
		document.dispatchEvent(new Event("scroll"));
		expect(nativeWindow.opacity).toBe(0.6);
		controller.dispose();
		vi.useRealTimers();
	});

	it("treats reading navigation and scrolling as activity", async () => {
		vi.useFakeTimers();
		const nativeWindow = new MockNativeWindow(10);
		nativeWindow.focused = true;
		const document = fakeDocument();
		const controller = new NativeWindowController(
			nativeWindow,
			document,
			vi.fn(),
			timerHost,
		);
		controller.setSmartFade({
			...INSTANT_SMART_FADE_SETTINGS,
			enabled: true,
			idleDelayMs: 250,
		});
		await vi.advanceTimersByTimeAsync(250);
		expect(nativeWindow.opacity).toBe(0.6);

		document.dispatchEvent(new Event("scroll"));
		expect(nativeWindow.opacity).toBe(0.92);
		await vi.advanceTimersByTimeAsync(249);
		expect(nativeWindow.opacity).toBe(0.92);
		document.dispatchEvent(new Event("keydown"));
		await vi.advanceTimersByTimeAsync(249);
		expect(nativeWindow.opacity).toBe(0.92);
		await vi.advanceTimersByTimeAsync(1);
		expect(nativeWindow.opacity).toBe(0.6);
		controller.dispose();
		vi.useRealTimers();
	});

	it("preserves pinning through fade states and restores it on unload", async () => {
		vi.useFakeTimers();
		const nativeWindow = new MockNativeWindow(9);
		nativeWindow.focused = true;
		const controller = new NativeWindowController(
			nativeWindow,
			fakeDocument(),
			vi.fn(),
			timerHost,
		);
		controller.setPreference({ opacity: 0.8, pinned: true });
		controller.setSmartFade({
			...INSTANT_SMART_FADE_SETTINGS,
			enabled: true,
			idleDelayMs: 250,
		});
		expect(nativeWindow.pinned).toBe(true);
		await vi.advanceTimersByTimeAsync(250);
		expect(nativeWindow.opacity).toBe(0.6);
		expect(nativeWindow.pinned).toBe(true);

		controller.dispose();
		expect(nativeWindow.opacity).toBe(1);
		expect(nativeWindow.pinned).toBe(false);
		vi.useRealTimers();
	});

	it("restores an unmanaged native opacity when smart fade is disabled", () => {
		const nativeWindow = new MockNativeWindow(7);
		nativeWindow.opacity = 0.35;
		const controller = new NativeWindowController(
			nativeWindow,
			fakeDocument(),
			vi.fn(),
			timerHost,
		);

		controller.setSmartFade({
			...INSTANT_SMART_FADE_SETTINGS,
			enabled: true,
		});
		expect(nativeWindow.opacity).toBe(0.6);
		controller.setSmartFade({
			...DEFAULT_SMART_FADE_SETTINGS,
			enabled: false,
		});
		expect(nativeWindow.opacity).toBe(0.35);
		controller.dispose();
	});

	it("animates idle and active opacity changes", async () => {
		vi.useFakeTimers();
		const nativeWindow = new MockNativeWindow(11);
		nativeWindow.focused = true;
		const document = fakeDocument();
		const controller = new NativeWindowController(
			nativeWindow,
			document,
			vi.fn(),
			timerHost,
		);
		controller.setSmartFade({
			...DEFAULT_SMART_FADE_SETTINGS,
			enabled: true,
			activeOpacity: 0.9,
			idleOpacity: 0.6,
			idleDelayMs: 250,
			transitionDurationMs: 100,
		});

		expect(nativeWindow.opacity).toBe(1);
		await vi.advanceTimersByTimeAsync(100);
		expect(nativeWindow.opacity).toBeCloseTo(0.9);
		await vi.advanceTimersByTimeAsync(150);
		expect(nativeWindow.opacity).toBeCloseTo(0.9);
		await vi.advanceTimersByTimeAsync(100);
		expect(nativeWindow.opacity).toBeCloseTo(0.6);

		document.dispatchEvent(new Event("keydown"));
		await vi.advanceTimersByTimeAsync(100);
		expect(nativeWindow.opacity).toBeCloseTo(0.9);
		controller.dispose();
		vi.useRealTimers();
	});

	it("interrupts an idle transition when reading resumes", async () => {
		vi.useFakeTimers();
		const nativeWindow = new MockNativeWindow(12);
		nativeWindow.focused = true;
		const document = fakeDocument();
		const controller = new NativeWindowController(
			nativeWindow,
			document,
			vi.fn(),
			timerHost,
		);
		controller.setSmartFade({
			...DEFAULT_SMART_FADE_SETTINGS,
			enabled: true,
			activeOpacity: 0.9,
			idleOpacity: 0.5,
			idleDelayMs: 250,
			transitionDurationMs: 200,
		});
		await vi.advanceTimersByTimeAsync(314);
		const interruptedOpacity = nativeWindow.opacity;
		document.dispatchEvent(new Event("scroll"));
		await vi.advanceTimersByTimeAsync(200);

		expect(interruptedOpacity).toBeLessThan(0.9);
		expect(nativeWindow.opacity).toBeCloseTo(0.9);
		controller.dispose();
		vi.useRealTimers();
	});

	it("uses instant changes when macOS reduced motion is enabled", () => {
		const nativeWindow = new MockNativeWindow(13);
		nativeWindow.focused = true;
		const controller = new NativeWindowController(
			nativeWindow,
			fakeDocument(true),
			vi.fn(),
			timerHost,
		);
		controller.setSmartFade({
			...DEFAULT_SMART_FADE_SETTINGS,
			enabled: true,
			transitionDurationMs: 180,
			respectReducedMotion: true,
		});

		expect(nativeWindow.opacity).toBe(0.92);
		nativeWindow.focused = false;
		nativeWindow.emit("blur");
		expect(nativeWindow.opacity).toBe(0.6);
		controller.dispose();
	});

	it("can animate when reduced-motion matching is explicitly ignored", async () => {
		vi.useFakeTimers();
		const nativeWindow = new MockNativeWindow(14);
		nativeWindow.focused = true;
		const controller = new NativeWindowController(
			nativeWindow,
			fakeDocument(true),
			vi.fn(),
			timerHost,
		);
		controller.setSmartFade({
			...DEFAULT_SMART_FADE_SETTINGS,
			enabled: true,
			transitionDurationMs: 100,
			respectReducedMotion: false,
		});

		expect(nativeWindow.opacity).toBe(1);
		await vi.advanceTimersByTimeAsync(100);
		expect(nativeWindow.opacity).toBeCloseTo(0.92);
		controller.dispose();
		vi.useRealTimers();
	});

	it("cancels transitions and restores the native snapshot on unload", async () => {
		vi.useFakeTimers();
		const nativeWindow = new MockNativeWindow(15);
		nativeWindow.opacity = 0.35;
		const controller = new NativeWindowController(
			nativeWindow,
			fakeDocument(),
			vi.fn(),
			timerHost,
		);
		controller.setSmartFade({
			...DEFAULT_SMART_FADE_SETTINGS,
			enabled: true,
			transitionDurationMs: 500,
		});
		await vi.advanceTimersByTimeAsync(32);
		expect(nativeWindow.opacity).not.toBe(0.35);

		controller.dispose();
		expect(nativeWindow.opacity).toBe(0.35);
		await vi.advanceTimersByTimeAsync(1_000);
		expect(nativeWindow.opacity).toBe(0.35);
		vi.useRealTimers();
	});

	it("reapplies the exact target immediately after native show or restore", async () => {
		vi.useFakeTimers();
		const nativeWindow = new MockNativeWindow(16);
		nativeWindow.focused = true;
		const controller = new NativeWindowController(
			nativeWindow,
			fakeDocument(),
			vi.fn(),
			timerHost,
		);
		controller.setSmartFade({
			...DEFAULT_SMART_FADE_SETTINGS,
			enabled: true,
			activeOpacity: 0.9,
			transitionDurationMs: 100,
		});
		await vi.advanceTimersByTimeAsync(100);
		expect(nativeWindow.opacity).toBeCloseTo(0.9);

		nativeWindow.opacity = 1;
		nativeWindow.emit("show");
		expect(nativeWindow.opacity).toBe(0.9);
		nativeWindow.opacity = 1;
		nativeWindow.emit("restore");
		expect(nativeWindow.opacity).toBe(0.9);
		controller.dispose();
		vi.useRealTimers();
	});

	it("contains native failures that occur during an animation frame", async () => {
		vi.useFakeTimers();
		const nativeWindow = new MockNativeWindow(17);
		nativeWindow.focused = true;
		const controller = new NativeWindowController(
			nativeWindow,
			fakeDocument(),
			vi.fn(),
			timerHost,
		);
		nativeWindow.setOpacity.mockImplementationOnce(() => {
			throw new Error("Opacity is unavailable");
		});
		controller.setSmartFade({
			...DEFAULT_SMART_FADE_SETTINGS,
			enabled: true,
			transitionDurationMs: 100,
		});

		await vi.advanceTimersByTimeAsync(100);
		expect(controller.lastError).toMatch(/unavailable/u);
		expect(nativeWindow.setOpacity).toHaveBeenCalledOnce();
		controller.dispose();
		vi.useRealTimers();
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
