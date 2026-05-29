import { describe, expect, it } from "vitest";
import { isLiveRunStatus } from "@/components/RunElapsed";
import { formatRunDuration } from "@/lib/agent-display";

describe("isLiveRunStatus", () => {
	it("treats queued and running as live", () => {
		expect(isLiveRunStatus("queued")).toBe(true);
		expect(isLiveRunStatus("running")).toBe(true);
	});

	it("treats terminal statuses as not live", () => {
		expect(isLiveRunStatus("succeeded")).toBe(false);
		expect(isLiveRunStatus("failed")).toBe(false);
	});
});

describe("formatRunDuration for completed runs", () => {
	it("is stable without a ticking clock", () => {
		const start = "2026-05-28T12:00:00.000Z";
		const end = "2026-05-28T12:01:05.000Z";
		const a = formatRunDuration(start, end);
		const b = formatRunDuration(start, end);
		expect(a).toBe("1m 5s");
		expect(b).toBe(a);
	});
});
