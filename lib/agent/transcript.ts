import { createHash } from "node:crypto";
import { LEGACY_TRANSCRIPT_TRUNCATED_MARKER } from "@/lib/agent/process";
import { isJsonObject } from "@/lib/json";

function eventId(line: string, index: number) {
	return `${index + 1}:${createHash("sha256").update(line).digest("hex").slice(0, 12)}`;
}

export function parseAgentEvents(transcript: string) {
	return transcript
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(
			(line) =>
				Boolean(line) && !line.includes(LEGACY_TRANSCRIPT_TRUNCATED_MARKER),
		)
		.map((line, index) => {
			const id = eventId(line, index);
			try {
				const parsed: unknown = JSON.parse(line);
				if (!isJsonObject(parsed)) {
					return { id, raw: line, type: "log", parsed: { message: line } };
				}
				return { id, raw: line, type: String(parsed.type ?? "event"), parsed };
			} catch {
				return { id, raw: line, type: "log", parsed: { message: line } };
			}
		});
}

/** @deprecated Use parseAgentEvents */
export const parseCodexEvents = parseAgentEvents;
