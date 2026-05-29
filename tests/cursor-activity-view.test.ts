import { createSdkMessageRunStreamEvent } from "@cursor/sdk";
import { describe, expect, it } from "vitest";
import { parseAgentEvents } from "@/lib/agent/transcript";
import {
	cursorEventsToActivityRows,
	mergeAssistantStreamText,
} from "@/lib/cursor-activity-view";
import { agentEventsToActivityRows } from "@/lib/activity-view";

describe("cursorEventsToActivityRows", () => {
	it("maps wrapped sdk_message stream rows after transcript parse", () => {
		const wrapped = createSdkMessageRunStreamEvent({
			type: "tool_call",
			agent_id: "a1",
			run_id: "r1",
			call_id: "c1",
			name: "bash",
			status: "completed",
			args: { command: "npm test" },
		});
		const events = parseAgentEvents(`${JSON.stringify(wrapped)}\n`);
		const rows = agentEventsToActivityRows({
			agentCore: "cursor",
			agentLabel: "Cursor SDK",
			events,
			maxBodyChars: 600,
			demoLive: true,
		});

		expect(rows.some((row) => row.variant === "tool")).toBe(true);
		expect(rows.some((row) => row.label.toLowerCase().includes("test"))).toBe(
			true,
		);
	});

	it("labels shell tool commands like bash", () => {
		const rows = cursorEventsToActivityRows([
			{
				id: "1",
				type: "tool_call",
				raw: "",
				parsed: {
					name: "shell",
					status: "completed",
					args: { command: "npm run build" },
				},
			},
		]);

		expect(rows.some((row) => row.label.toLowerCase().includes("build"))).toBe(
			true,
		);
	});

	it("collapses assistant streaming deltas into one summary row", () => {
		const rows = cursorEventsToActivityRows(
			[
				{
					id: "1",
					type: "assistant",
					raw: "",
					parsed: {
						message: {
							role: "assistant",
							content: [{ type: "text", text: "I'll" }],
						},
					},
				},
				{
					id: "2",
					type: "assistant",
					raw: "",
					parsed: {
						message: {
							role: "assistant",
							content: [{ type: "text", text: " read theme.ts" }],
						},
					},
				},
				{
					id: "3",
					type: "assistant",
					raw: "",
					parsed: {
						message: {
							role: "assistant",
							content: [
								{
									type: "text",
									text: "I'll read theme.ts and update the storefront variant.",
								},
							],
						},
					},
				},
			],
			600,
			{ demoLive: true },
		);

		const proseRows = rows.filter((row) => row.variant === "prose");
		expect(proseRows).toHaveLength(1);
		expect(proseRows[0]?.body).toContain("read theme.ts");
	});

	it("dedupes tool_call updates by call_id", () => {
		const rows = cursorEventsToActivityRows(
			[
				{
					id: "1",
					type: "tool_call",
					raw: "",
					parsed: {
						call_id: "c1",
						name: "read",
						status: "running",
						args: { path: "src/theme.ts" },
					},
				},
				{
					id: "2",
					type: "tool_call",
					raw: "",
					parsed: {
						call_id: "c1",
						name: "read",
						status: "completed",
						args: { path: "src/theme.ts" },
					},
				},
				{
					id: "3",
					type: "tool_call",
					raw: "",
					parsed: {
						call_id: "c1",
						name: "read",
						status: "completed",
						args: { path: "src/theme.ts" },
					},
				},
			],
			600,
			{ demoLive: true },
		);

		const readRows = rows.filter((row) => row.id === "tool:c1");
		expect(readRows).toHaveLength(1);
		expect(readRows[0]?.label).toContain("completed");
	});

	it("maps tool_call and thinking events into activity rows", () => {
		const rows = cursorEventsToActivityRows([
			{
				id: "1",
				type: "thinking",
				raw: "",
				parsed: { text: "read src/theme.ts\nedit src/theme.ts" },
			},
			{
				id: "2",
				type: "tool_call",
				raw: "",
				parsed: {
					name: "bash",
					status: "completed",
					args: { command: "npm test" },
				},
			},
		]);

		expect(rows.length).toBeGreaterThanOrEqual(2);
		expect(rows.some((row) => row.variant === "tool")).toBe(true);
		expect(rows.some((row) => row.label.toLowerCase().includes("test"))).toBe(
			true,
		);
	});
});

describe("mergeAssistantStreamText", () => {
	it("prefers the longest assistant snapshot", () => {
		expect(mergeAssistantStreamText("I'll", "I'll read files.")).toBe(
			"I'll read files.",
		);
	});
});
