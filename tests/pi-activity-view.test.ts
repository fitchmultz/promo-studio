import { describe, expect, it } from "vitest";
import {
	formatPiBashCall,
	piEventsToActivityRows,
	type PiActivityInputEvent,
} from "@/lib/pi-activity-view";

function ev(
	type: string,
	parsed: Record<string, unknown>,
	raw = JSON.stringify({ type, ...parsed }),
): PiActivityInputEvent {
	return { id: `e-${type}`, type, raw, parsed: { type, ...parsed } };
}

describe("piEventsToActivityRows", () => {
	it("demo live mode extracts thinking actions instead of essay blocks", () => {
		const rows = piEventsToActivityRows(
			[
				ev("message_update", {
					assistantMessageEvent: { type: "thinking_delta", delta: "plan " },
				}),
				ev("message_update", {
					assistantMessageEvent: { type: "thinking_delta", delta: "ahead" },
				}),
				ev("message_update", {
					assistantMessageEvent: { type: "text_delta", delta: "Hello " },
				}),
				ev("message_update", {
					assistantMessageEvent: { type: "text_delta", delta: "world" },
				}),
			],
			8000,
			{ demoLive: true },
		);
		expect(rows.map((r) => r.label)).toEqual(["Agent message"]);
		expect(rows[0]?.body).toContain("Hello");
	});

	it("demo live mode maps bash tool to Codex-style labels", () => {
		const rows = piEventsToActivityRows(
			[
				ev("tool_execution_start", {
					toolName: "bash",
					toolCallId: "1",
					args: { command: "npm test" },
				}),
			],
			4000,
			{ demoLive: true },
		);
		expect(rows[0]?.label).toBe("Running tests");
		expect(rows[0]?.body).toContain("npm test");
	});

	it("extracts read/edit lines from thinking_start partials (cursor-sdk)", () => {
		const rows = piEventsToActivityRows(
			[
				ev("message_update", {
					assistantMessageEvent: {
						type: "thinking_start",
						partial: {
							role: "assistant",
							content: [
								{
									type: "thinking",
									thinking:
										"read package.json\n\n{\n  \"name\": \"demo\"\n}\n100% organic cotton canvas",
								},
							],
						},
					},
				}),
			],
			8000,
			{ demoLive: true },
		);
		expect(rows.map((r) => r.label)).toEqual(["Read file"]);
		expect(rows[0]?.body).toContain("read package.json");
		expect(rows[0]?.body).not.toContain("organic cotton");
	});

	it("skips raw JSON lifecycle noise in demo mode", () => {
		const rows = piEventsToActivityRows(
			[
				ev("turn_start", { turn: 1 }),
				ev("agent_start", {}),
			],
			4000,
			{ demoLive: true },
		);
		expect(rows.map((r) => r.label)).toEqual(["Pi agent started"]);
	});
});

describe("formatPiBashCall", () => {
	it("includes timeout suffix when present", () => {
		const formatted = formatPiBashCall({
			command: "npm run build",
			timeout: 120,
		});
		expect(formatted).toContain("npm run build");
		expect(formatted).toContain("(timeout 120s)");
	});
});
