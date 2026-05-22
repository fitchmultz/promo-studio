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
	it("merges consecutive thinking and text deltas", () => {
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
		);
		expect(rows.map((r) => r.label)).toEqual(["Thinking", "Assistant"]);
		expect(rows[0]?.body).toBe("plan ahead");
		expect(rows[1]?.body).toBe("Hello world");
	});

	it("formats bash tool like the Pi TUI", () => {
		const rows = piEventsToActivityRows(
			[
				ev("tool_execution_start", {
					toolName: "bash",
					toolCallId: "1",
					args: { command: "npm test" },
				}),
			],
			4000,
		);
		expect(rows[0]?.variant).toBe("tool");
		expect(rows[0]?.body).toBe("$ npm test");
	});

	it("skips message_start and message_end noise", () => {
		const rows = piEventsToActivityRows(
			[
				ev("message_start", { message: { role: "assistant" } }),
				ev("message_end", { message: { role: "assistant" } }),
				ev("agent_start", {}),
			],
			4000,
		);
		expect(rows.map((r) => r.label)).toEqual(["Agent started"]);
	});
});

describe("formatPiBashCall", () => {
	it("includes timeout suffix when present", () => {
		expect(formatPiBashCall({ command: "npm run build", timeout: 120 })).toBe(
			"$ npm run build (timeout 120s)",
		);
	});
});
