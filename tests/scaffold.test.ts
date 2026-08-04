import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("plugin manifest", () => {
	it("declares a desktop-only Window Overlay plugin", () => {
		const manifest = JSON.parse(
			readFileSync(new URL("../manifest.json", import.meta.url), "utf8"),
		) as Record<string, unknown>;

		expect(manifest).toMatchObject({
			id: "window-overlay",
			isDesktopOnly: true,
			minAppVersion: "1.13.0",
			name: "Window Overlay",
		});
	});
});

