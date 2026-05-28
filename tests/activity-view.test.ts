import { describe, expect, it } from "vitest";
import { agentEventsToActivityRows } from "@/lib/activity-view";

describe("activity-view facade", () => {
	it("routes Pi events to Pi activity rows", () => {
		const rows = agentEventsToActivityRows({
			agentCore: "pi",
			agentLabel: "Composer",
			events: [
				{
					id: "e1",
					type: "tool_execution_start",
					raw: "",
					parsed: {
						type: "tool_execution_start",
						toolName: "bash",
						toolCallId: "1",
						args: { command: "npm test" },
					},
				},
			],
			maxBodyChars: 4000,
			demoLive: true,
		});
		expect(rows[0]?.label).toBe("Running tests");
	});

	it("routes Cursor SDK events to Cursor activity rows", () => {
		const rows = agentEventsToActivityRows({
			agentCore: "cursor",
			agentLabel: "Composer 2.5 Fast",
			events: [
				{
					id: "e1",
					type: "tool_call",
					raw: "",
					parsed: {
						name: "bash",
						status: "completed",
						args: { command: "npm test" },
					},
				},
			],
			maxBodyChars: 4000,
			demoLive: true,
		});
		expect(rows[0]?.label.toLowerCase()).toContain("test");
	});

	it("routes Codex events to Codex activity rows", () => {
		const events = [
			{
				id: "e1",
				type: "turn.started",
				raw: "",
				parsed: { type: "turn.started" },
			},
		];
		const rows = agentEventsToActivityRows({
			agentCore: "codex",
			agentLabel: "Codex",
			events,
			maxBodyChars: 4000,
			demoLive: true,
		});
		expect(rows[0]?.label).toBe("Codex turn");
	});
});
