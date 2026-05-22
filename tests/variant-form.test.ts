// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentSettingsProvider } from "@/components/AgentSettingsProvider";
import { VariantForm } from "@/components/VariantForm";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn() }),
}));

const actGlobal = globalThis as typeof globalThis & {
	IS_REACT_ACT_ENVIRONMENT?: boolean;
};
actGlobal.IS_REACT_ACT_ENVIRONMENT = true;

describe("VariantForm", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.append(container);
		root = createRoot(container);
		act(() => {
			root.render(
				React.createElement(
					AgentSettingsProvider,
					null,
					React.createElement(VariantForm, { productId: "product-1" }),
				),
			);
		});
	});

	afterEach(() => {
		act(() => root.unmount());
		container.remove();
	});

	function briefField() {
		const field = container.querySelector<HTMLTextAreaElement>(
			'textarea[name="campaignBrief"]',
		);
		if (!field) throw new Error("Campaign brief field was not rendered.");
		return field;
	}

	function clickPreset(label: string) {
		const button = Array.from(container.querySelectorAll("button")).find(
			(element) => element.textContent === label,
		);
		if (!button) throw new Error(`${label} button was not rendered.`);
		act(() => button.click());
	}

	it("updates the suggested brief when selecting a preset", () => {
		clickPreset("Low-stock urgency");

		expect(briefField().value).toContain("only 3 left in stock");
		expect(
			container.querySelector<HTMLInputElement>('input[name="campaignGoal"]')
				?.value,
		).toBe("Low-stock urgency");
	});

	it("does not overwrite a custom user brief when changing presets", () => {
		const field = briefField();
		act(() => {
			const valueSetter = Object.getOwnPropertyDescriptor(
				HTMLTextAreaElement.prototype,
				"value",
			)?.set;
			valueSetter?.call(field, "Keep my custom campaign angle.");
			field.dispatchEvent(new Event("input", { bubbles: true }));
		});

		clickPreset("Back-to-work launch");

		expect(briefField().value).toBe("Keep my custom campaign angle.");
		expect(
			container.querySelector<HTMLInputElement>('input[name="campaignGoal"]')
				?.value,
		).toBe("Back-to-work launch");
	});
});
