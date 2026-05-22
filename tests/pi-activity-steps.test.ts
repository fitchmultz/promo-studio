import { describe, expect, it } from "vitest";
import {
	classifyThinkingActionLine,
	extractThinkingActions,
	labelForPiActionEnd,
	labelForPiActionStart,
	summarizeAssistantProse,
	type PiThinkingAction,
} from "@/lib/pi-activity-steps";

describe("pi-activity-steps", () => {
	it("filters product feature noise from thinking lines", () => {
		expect(classifyThinkingActionLine("100% organic cotton canvas")).toBeNull();
		expect(classifyThinkingActionLine("read src/product.ts")?.action).toBe(
			"read product.ts",
		);
	});

	it("extracts unique actions from thinking text", () => {
		const actions = extractThinkingActions(
			"read AGENTS.md\nread package.json\n$ npm test\n$ npm run build",
		);
		expect(actions.map((a) => a.action)).toEqual([
			"read AGENTS.md",
			"read package.json",
			"$ npm test",
			"$ npm run build",
		]);
	});

	it("maps npm test to running tests milestone", () => {
		const testAction = classifyThinkingActionLine("npm test");
		const buildAction = classifyThinkingActionLine("npm run build");
		expect(testAction?.kind).toBe("shell");
		expect(labelForPiActionStart(testAction!)).toBe("Running tests");
		expect(labelForPiActionStart(buildAction!)).toBe("Building preview");
	});

	it("provides start and end labels for edit actions", () => {
		const action: PiThinkingAction = {
			kind: "edit",
			action: "edit src/foo.tsx",
		};
		expect(labelForPiActionStart(action)).toBe("File edit started");
		expect(labelForPiActionEnd(action)).toBe("File edit completed");
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
