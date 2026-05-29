import { createSdkMessageRunStreamEvent } from "@cursor/sdk";
import { describe, expect, it } from "vitest";
import { parseAgentEvents } from "@/lib/agent/transcript";
import {
	cursorStreamEventToTranscriptLine,
	unwrapCursorSdkMessage,
} from "@/lib/cursor-transcript";

describe("cursor transcript normalization", () => {
	it("unwraps sdk_message envelopes for activity parsing", () => {
		const wrapped = createSdkMessageRunStreamEvent({
			type: "tool_call",
			agent_id: "a1",
			run_id: "r1",
			call_id: "c1",
			name: "read",
			status: "completed",
			args: { path: "src/theme.ts" },
		});

		const unwrapped = unwrapCursorSdkMessage(
			wrapped as unknown as Record<string, unknown>,
		);
		expect(unwrapped.type).toBe("tool_call");
		expect(unwrapped.name).toBe("read");

		const events = parseAgentEvents(
			`${JSON.stringify(wrapped)}\n${cursorStreamEventToTranscriptLine(wrapped)}`,
		);
		expect(events[0]?.type).toBe("tool_call");
		expect(events[1]?.type).toBe("tool_call");
	});

	it("writes SDKMessage lines from stream events", () => {
		const wrapped = createSdkMessageRunStreamEvent({
			type: "thinking",
			agent_id: "a1",
			run_id: "r1",
			text: "read src/theme.ts",
		});
		const line = cursorStreamEventToTranscriptLine(wrapped);
		const parsed = JSON.parse(line) as { type: string; text?: string };
		expect(parsed.type).toBe("thinking");
		expect(parsed.text).toBe("read src/theme.ts");
	});
});
