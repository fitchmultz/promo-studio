import { describe, expect, it } from "vitest";
import { transcriptBodyForDb } from "@/lib/agent/transcript-store";
import {
	appendLimited,
	MAX_DB_TRANSCRIPT_CHARS,
	MAX_POLL_TRANSCRIPT_CHARS,
	MAX_PROCESS_OUTPUT_CHARS,
	tailJsonlForPoll,
} from "@/lib/agent/process";
import { parseAgentEvents } from "@/lib/agent/transcript";

describe("transcript capture buffers", () => {
	it("appendLimited keeps the tail for subprocess buffers", () => {
		const head = "a".repeat(MAX_PROCESS_OUTPUT_CHARS);
		const result = appendLimited(head, "TAIL_MARKER");
		expect(result.endsWith("TAIL_MARKER")).toBe(true);
		expect(result.length).toBe(MAX_PROCESS_OUTPUT_CHARS);
	});

	it("tailJsonlForPoll keeps recent lines without promo-studio markers", () => {
		const lines = Array.from(
			{ length: 50 },
			(_, index) => `{"type":"message_update","n":${index}}`,
		);
		const full = `${lines.join("\n")}\n`;
		const tailed = tailJsonlForPoll(full, 200);
		expect(tailed).not.toContain("[promo-studio:");
		expect(tailed).toContain('"n":49');
		expect(parseAgentEvents(tailed).length).toBeGreaterThan(0);
	});

	it("transcriptBodyForDb stores full text when under cap", () => {
		const small = '{"type":"session"}\n';
		expect(transcriptBodyForDb(small)).toBe(small);
	});

	it("transcriptBodyForDb tails large traces silently", () => {
		const lines = Array.from(
			{ length: 80_000 },
			(_, index) =>
				`{"type":"message_update","payload":"${"x".repeat(60)}","n":${index}}`,
		);
		const huge = `${lines.join("\n")}\n`;
		expect(huge.length).toBeGreaterThan(MAX_DB_TRANSCRIPT_CHARS);
		const stored = transcriptBodyForDb(huge);
		expect(stored.length).toBeLessThanOrEqual(MAX_DB_TRANSCRIPT_CHARS + 100);
		expect(stored).not.toContain("[promo-studio:");
	});
});
