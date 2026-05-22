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

	it("stays at starting when pi transcript only contains the campaign prompt", () => {
		const phase = inferRunPhase({
			status: "running",
			agentCore: "pi",
			hasPreview: false,
			events: [
				{
					type: "message_update",
					raw: '{"type":"message_update","assistantMessageEvent":{"type":"text_start"}}',
					parsed: {
						assistantMessageEvent: {
							type: "text_start",
							partial: {
								role: "user",
								content: [
									{
										type: "text",
										text: "Write artifact/manifest.json with testsPassed true",
									},
								],
							},
						},
					},
				},
			],
		});
		expect(phase.id).toBe("starting");
		expect(phase.step).toBe(1);
	});

	it("infers manifest only from pi tool activity targeting manifest.json", () => {
		const phase = inferRunPhase({
			status: "running",
			agentCore: "pi",
			hasPreview: false,
			events: [
				{
					type: "tool_execution_start",
					raw: '{"toolName":"write","args":{"path":"artifact/manifest.json"}}',
					parsed: {
						toolName: "write",
						args: { path: "artifact/manifest.json" },
					},
				},
			],
		});
		expect(phase.id).toBe("manifest");
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
