import { describe, expect, it } from "vitest";
import { ContrastShieldController } from "../src/contrast/contrast-shield-controller";

function fakeDocument(originalMarker?: string): Document {
	const dataset: DOMStringMap = {};
	if (originalMarker !== undefined) {
		dataset.windowOverlayContrastShield = originalMarker;
	}
	return {
		documentElement: { dataset },
	} as unknown as Document;
}

describe("contrast shield controller", () => {
	it("applies levels immediately and removes the marker for none", () => {
		const document = fakeDocument();
		const controller = new ContrastShieldController(document);

		expect(controller.set("medium")).toBe(true);
		expect(document.documentElement.dataset.windowOverlayContrastShield).toBe(
			"medium",
		);
		expect(controller.level).toBe("medium");
		controller.set("none");
		expect(
			document.documentElement.dataset.windowOverlayContrastShield,
		).toBeUndefined();
	});

	it("restores the exact marker that existed before adoption", () => {
		const document = fakeDocument("legacy");
		const controller = new ContrastShieldController(document);
		controller.set("strong");
		controller.dispose();

		expect(document.documentElement.dataset.windowOverlayContrastShield).toBe(
			"legacy",
		);
	});

	it("removes its marker on normal disposal", () => {
		const document = fakeDocument();
		const controller = new ContrastShieldController(document);
		controller.set("subtle");
		controller.dispose();

		expect(
			document.documentElement.dataset.windowOverlayContrastShield,
		).toBeUndefined();
	});
});
