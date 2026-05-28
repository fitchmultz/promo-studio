import { describe, expect, it } from "vitest";
import {
	builtVariantHeading,
	formatRunDuration,
	formatShellCommandForDisplay,
	humanizeModelId,
	modelIdFromSelected,
	runAgentDisplayLabel,
	studioAgentIntroSentence,
	workspacePathForDisplay,
} from "@/lib/agent-display";

describe("agent-display", () => {
	it("returns workspace paths unchanged for display", () => {
		const path = "/repo/agent-workspaces/run-abc/storefront";
		expect(workspacePathForDisplay("pi", path)).toBe(path);
	});

	it("humanizes Pi and Codex model ids for run-facing labels", () => {
		expect(modelIdFromSelected("cursor/composer-2.5")).toBe("composer-2.5");
		expect(humanizeModelId("composer-2.5")).toBe("Composer 2.5");
		expect(
			runAgentDisplayLabel({
				agentCore: "pi",
				selectedModel: "cursor/composer-2.5",
			}),
		).toBe("Composer 2.5");
		expect(
			runAgentDisplayLabel({
				agentCore: "pi",
				selectedModel: "pi-default",
			}),
		).toBe("Pi");
		expect(builtVariantHeading("pi", "cursor/composer-2.5")).toBe(
			"After: Composer 2.5-built campaign variant",
		);
		expect(
			runAgentDisplayLabel({
				agentCore: "codex",
				selectedModel: "gpt-5.5-mini",
			}),
		).toBe("GPT-5.5 mini");
	});

	it("builds studio intro copy from agent core", () => {
		expect(studioAgentIntroSentence("pi", "Demo User")).toContain("Pi edits");
		expect(studioAgentIntroSentence("pi", "Demo User")).not.toContain("Codex");
		expect(studioAgentIntroSentence("codex", "Demo User")).toContain(
			"Codex edits",
		);
	});

	it("counts elapsed time from start when run is still in progress", () => {
		const start = new Date("2026-05-22T12:00:00Z");
		const now = new Date("2026-05-22T12:01:05Z");
		expect(formatRunDuration(start, null, now)).toBe("1m 5s");
	});

	it("shortens shell cd paths under agent-workspaces", () => {
		const cmd =
			"$ cd /Users/demo/promo-studio/agent-workspaces/run-9caaa7c5-e1f0-4e45-b875-1c13915a33a5/storefront && npm test";
		const shown = formatShellCommandForDisplay(cmd);
		expect(shown).toContain("agent-workspaces/run-");
		expect(shown).toContain("npm test");
	});
});
