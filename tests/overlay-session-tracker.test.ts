import { describe, expect, it } from "vitest";
import { OverlaySessionTracker } from "../src/overlay/overlay-session-tracker";

function domWindow(closed = false): Window {
	return { closed } as Window;
}

describe("overlay session tracker", () => {
	it("returns an existing live overlay and drops closed overlays", () => {
		const tracker = new OverlaySessionTracker();
		const existing = domWindow();
		tracker.track("Call.md", existing);

		expect(tracker.get("Call.md")).toBe(existing);
		Object.assign(existing, { closed: true });
		expect(tracker.get("Call.md")).toBeNull();
	});

	it("migrates and removes file and folder paths", () => {
		const tracker = new OverlaySessionTracker();
		const existing = domWindow();
		tracker.track("Meetings/Call.md", existing);
		tracker.migratePath("Meetings", "Archive/Meetings");

		expect(tracker.get("Meetings/Call.md")).toBeNull();
		expect(tracker.get("Archive/Meetings/Call.md")).toBe(existing);
		tracker.removePath("Archive");
		expect(tracker.get("Archive/Meetings/Call.md")).toBeNull();
	});
});
