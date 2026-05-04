import { describe, expect, it } from "vitest";
import { summarizeDiff } from "@/components/DiffViewer";

describe("summarizeDiff", () => {
	it("labels removed and added lines for colorized rendering", () => {
		expect(summarizeDiff("old\nkept", "new\nkept")).toMatchObject([
			{ kind: "removed", text: "- old" },
			{ kind: "added", text: "+ new" },
		]);
	});

	it("labels new files as additions", () => {
		expect(summarizeDiff("", "first\nsecond")).toMatchObject([
			{ kind: "added", text: "+ first" },
			{ kind: "added", text: "+ second" },
		]);
	});
});
