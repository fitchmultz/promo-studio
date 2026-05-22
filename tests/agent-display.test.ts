import { describe, expect, it } from "vitest";
import {
	formatShellCommandForDisplay,
	workspacePathForDisplay,
} from "@/lib/agent-display";

describe("agent-display", () => {
	it("rewrites codex-workspaces to agent-workspaces in display paths", () => {
		expect(
			workspacePathForDisplay(
				"pi",
				"/repo/codex-workspaces/run-abc/storefront",
			),
		).toContain("agent-workspaces/run-abc");
		expect(
			workspacePathForDisplay(
				"pi",
				"/repo/codex-workspaces/run-abc/storefront",
			),
		).not.toContain("codex-workspaces");
	});

	it("rewrites shell cd paths to agent-workspaces", () => {
		const cmd =
			"$ cd /Users/demo/promo-studio-pi/codex-workspaces/run-9caaa7c5-e1f0-4e45-b875-1c13915a33a5/storefront && npm test";
		const shown = formatShellCommandForDisplay(cmd);
		expect(shown).toContain("agent-workspaces");
		expect(shown).not.toContain("codex-workspaces");
		expect(shown).toContain("npm test");
	});
});
