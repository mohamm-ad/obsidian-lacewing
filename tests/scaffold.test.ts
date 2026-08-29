import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("plugin manifest", () => {
	it("declares the desktop-only Lacewing plugin", () => {
		const manifest = JSON.parse(
			readFileSync(new URL("../manifest.json", import.meta.url), "utf8"),
		) as Record<string, unknown>;

		expect(manifest).toMatchObject({
			id: "lacewing",
			isDesktopOnly: true,
			minAppVersion: "1.13.0",
			name: "Lacewing Window Transparency",
		});
	});
});
