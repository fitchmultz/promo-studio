import { describe, expect, it } from "vitest";
import { inferRunPhase } from "@/lib/run-phase";

describe("inferRunPhase", () => {
	it("returns preview when succeeded with preview html", () => {
		const phase = inferRunPhase({
			status: "succeeded",
			agentCore: "pi",
			hasPreview: true,
			events: [],
		});
		expect(phase.id).toBe("preview");
	});

	it("infers testing phase from npm test in pi transcript", () => {
		const phase = inferRunPhase({
			status: "running",
			agentCore: "pi",
			hasPreview: false,
			events: [
				{
					type: "tool_execution_start",
					raw: '{"toolName":"bash","args":{"command":"npm test"}}',
					parsed: {
						toolName: "bash",
						args: { command: "npm test" },
					},
				},
			],
		});
		expect(phase.id).toBe("testing");
		expect(phase.label).toContain("test");
	});
});
