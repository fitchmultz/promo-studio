import { describe, expect, it } from "vitest";
import {
	appendLimited,
	appendTranscript,
	MAX_PROCESS_OUTPUT_CHARS,
	MAX_TRANSCRIPT_CHARS,
	TRANSCRIPT_TRUNCATED_MARKER,
} from "@/lib/agent/process";

describe("transcript capture buffers", () => {
	it("appendLimited keeps the tail for subprocess buffers", () => {
		const head = "a".repeat(MAX_PROCESS_OUTPUT_CHARS);
		const result = appendLimited(head, "TAIL_MARKER");
		expect(result.endsWith("TAIL_MARKER")).toBe(true);
		expect(result.length).toBe(MAX_PROCESS_OUTPUT_CHARS);
	});

	it("appendTranscript keeps the head for persisted JSONL", () => {
		const session = '{"type":"session","version":3}\n';
		const tail = "z".repeat(MAX_TRANSCRIPT_CHARS);
		const result = appendTranscript(session, tail);
		expect(result.startsWith(session)).toBe(true);
		expect(result).toContain(TRANSCRIPT_TRUNCATED_MARKER);
	});

	it("appendTranscript does not grow after truncation marker is written", () => {
		const first = appendTranscript("", "x".repeat(MAX_TRANSCRIPT_CHARS + 1));
		const second = appendTranscript(first, "more\n");
		expect(second).toBe(first);
	});
});
