import { createHash } from "node:crypto";

function isJsonObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function eventId(line: string, index: number) {
	return `${index + 1}:${createHash("sha256").update(line).digest("hex").slice(0, 12)}`;
}

export function parseAgentEvents(transcript: string) {
	return transcript
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
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
