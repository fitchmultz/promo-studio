import { describe, expect, it } from "vitest";
import {
	appendLimited,
	MAX_POLL_TRANSCRIPT_CHARS,
	MAX_PROCESS_OUTPUT_CHARS,
	tailJsonlForPoll,
} from "@/lib/agent/process";
import { transcriptBodyForDb } from "@/lib/agent/transcript-store";

describe("transcript capture buffers", () => {
	it("appendLimited keeps the tail for subprocess buffers", () => {
		const head = "a".repeat(MAX_PROCESS_OUTPUT_CHARS);
		const result = appendLimited(head, "TAIL_MARKER");
		expect(result.endsWith("TAIL_MARKER")).toBe(true);
		expect(result.length).toBe(MAX_PROCESS_OUTPUT_CHARS);
	});

	it("tailJsonlForPoll keeps recent lines without injecting markers", () => {
		const lines = Array.from(
			{ length: 50 },
			(_, index) => `{"type":"message_update","n":${index}}`,
		);
		const full = `${lines.join("\n")}\n`;
		const tailed = tailJsonlForPoll(full, 200);
		expect(tailed).not.toContain("[promo-studio:");
		expect(tailed).toContain('"n":49');
		expect(tailed.length).toBeLessThanOrEqual(200 + 80);
	});

	it("tailJsonlForPoll returns full text when under cap", () => {
		const small = '{"type":"session"}\n{"type":"agent_start"}\n';
		expect(tailJsonlForPoll(small, MAX_POLL_TRANSCRIPT_CHARS)).toBe(small);
	});

	it("transcriptBodyForDb uses tail only when over DB cap", () => {
		const lines = Array.from(
			{ length: 200 },
			(_, index) => `{"type":"message_update","n":${index},"pad":"${"y".repeat(30_000)}"}`,
		);
		const huge = `${lines.join("\n")}\n`;
		const body = transcriptBodyForDb(huge);
		expect(body.length).toBeLessThan(huge.length);
		expect(body).not.toContain("[promo-studio:");
	});
});
