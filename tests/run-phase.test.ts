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

	it("infers discovering from codex shell commands that are not npm test/build", () => {
		const phase = inferRunPhase({
			status: "running",
			agentCore: "codex",
			hasPreview: false,
			events: [
				{
					type: "item.completed",
					raw: "{}",
					parsed: {
						item: {
							type: "command_execution",
							command: "date",
							status: "completed",
						},
					},
				},
			],
		});
		expect(phase.id).toBe("discovering");
		expect(phase.step).toBe(2);
	});

	it("ignores pi thinking-style prose when no tool activity exists", () => {
		const phase = inferRunPhase({
			status: "running",
			agentCore: "pi",
			hasPreview: false,
			events: [
				{
					type: "message_update",
					raw: "{}",
					parsed: {
						assistantMessageEvent: {
							type: "thinking_delta",
							delta: "read AGENTS.md\nread theme.ts\n",
						},
					},
				},
			],
		});
		expect(phase.id).toBe("starting");
		expect(phase.step).toBe(1);
	});

	it("keeps editing when codex file_change is followed by discovery shell commands", () => {
		const phase = inferRunPhase({
			status: "running",
			agentCore: "codex",
			hasPreview: false,
			events: [
				{
					type: "item.completed",
					raw: "{}",
					parsed: {
						item: { type: "file_change", status: "completed", changes: [] },
					},
				},
				{
					type: "item.completed",
					raw: "{}",
					parsed: {
						item: {
							type: "command_execution",
							command: "sed -n '1,220p' AGENTS.md",
							status: "completed",
						},
					},
				},
			],
		});
		expect(phase.id).toBe("editing");
		expect(phase.step).toBe(3);
	});

	it("infers editing phase from Pi edit tool events", () => {
		const phase = inferRunPhase({
			status: "running",
			agentCore: "pi",
			hasPreview: false,
			events: [
				{
					type: "tool_execution_start",
					raw: "{}",
					parsed: {
						toolName: "edit",
						args: { path: "src/App.tsx" },
					},
				},
			],
		});
		expect(phase.id).toBe("editing");
	});

	it("infers editing phase from Cursor SDK edit tool events", () => {
		const phase = inferRunPhase({
			status: "running",
			agentCore: "cursor",
			hasPreview: false,
			events: [
				{
					type: "tool_call",
					raw: "{}",
					parsed: {
						name: "edit",
						status: "completed",
						args: { path: "src/App.tsx" },
					},
				},
			],
		});
		expect(phase.id).toBe("editing");
	});

	it("infers testing phase from Cursor SDK tool_call shell events", () => {
		const phase = inferRunPhase({
			status: "running",
			agentCore: "cursor",
			hasPreview: false,
			events: [
				{
					type: "tool_call",
					raw: "{}",
					parsed: {
						name: "shell",
						status: "completed",
						args: { command: "npm test" },
					},
				},
			],
		});
		expect(phase.id).toBe("testing");
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
