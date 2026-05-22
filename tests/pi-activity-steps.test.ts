import { describe, expect, it } from "vitest";
import {
	classifyThinkingActionLine,
	extractThinkingActions,
	summarizeAssistantProse,
} from "@/lib/pi-activity-steps";

describe("pi-activity-steps", () => {
	it("filters product feature noise from thinking lines", () => {
		expect(classifyThinkingActionLine("100% organic cotton canvas")).toBeNull();
		expect(classifyThinkingActionLine("read src/product.ts")).toBe(
			"read product.ts",
		);
	});

	it("extracts unique actions from thinking text", () => {
		const actions = extractThinkingActions(
			"read AGENTS.md\nread package.json\n$ npm test\n$ npm run build",
		);
		expect(actions).toEqual([
			"read AGENTS.md",
			"read package.json",
			"$ npm test",
			"$ npm run build",
		]);
	});

	it("summarizes assistant prose to one line", () => {
		const summary = summarizeAssistantProse(
			"The user wants a holiday variant. I will read files first. Then I will edit components.",
		);
		expect(summary).toBe(
			"The user wants a holiday variant.",
		);
	});
});
