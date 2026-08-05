import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

describe("contrast shield styles", () => {
	it("defines all visible strengths for light and dark themes", () => {
		for (const level of ["subtle", "medium", "strong"]) {
			expect(styles).toContain(
				`data-window-overlay-contrast-shield="${level}"`,
			);
		}
		expect(styles).toContain("body.theme-light");
		expect(styles).toContain("body.theme-dark");
	});

	it("scopes the backing surface to Markdown content", () => {
		expect(styles).toContain(
			'.workspace-leaf-content[data-type="markdown"]',
		);
		expect(styles).toContain(".markdown-source-view");
		expect(styles).toContain(".markdown-reading-view");
		expect(styles).toContain(".view-content");
	});

	it("changes only background color rather than content opacity", () => {
		const shieldStyles = styles.slice(
			styles.indexOf("html[data-window-overlay-contrast-shield]"),
		);
		expect(shieldStyles).toContain("background-color");
		expect(shieldStyles).not.toMatch(/\bopacity\s*:/u);
	});
});
