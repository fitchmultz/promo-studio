import { describe, expect, it } from "vitest";
import { codexEventsToActivityRows } from "@/lib/codex-activity-view";

describe("codexEventsToActivityRows", () => {
	it("labels turn and command execution events", () => {
		const rows = codexEventsToActivityRows(
			[
				{
					id: "e-turn",
					type: "turn.started",
					raw: '{"type":"turn.started"}',
					parsed: { type: "turn.started" },
				},
				{
					id: "e-shell",
					type: "item.completed",
					raw: "",
					parsed: {
						type: "item.completed",
						item: {
							type: "command_execution",
							status: "completed",
							command: "/bin/zsh -lc npm test",
							aggregated_output: "ok",
						},
					},
				},
			],
			8000,
		);
		expect(rows.map((row) => row.label)).toEqual([
			"Codex turn",
			"Shell command completed",
		]);
		expect(rows[1]?.body).toContain("npm test");
	});

	it("shortens file_change paths under storefront", () => {
		const rows = codexEventsToActivityRows(
			[
				{
					id: "e-file",
					type: "item.completed",
					raw: "",
					parsed: {
						type: "item.completed",
						item: {
							type: "file_change",
							status: "completed",
							changes: [
								{
									kind: "update",
									path: "/repo/agent-workspaces/run-1/storefront/src/theme.ts",
								},
							],
						},
					},
				},
			],
			4000,
		);
		expect(rows[0]?.body).toContain("update: src/theme.ts");
	});
});
