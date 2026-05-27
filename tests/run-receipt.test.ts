import type { VariantRun } from "@prisma/client";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RunReceipt } from "@/components/RunReceipt";

function runWithInvocation(
	codexCommand: string,
	codexRuntime = "sdk",
	agentHarness = codexRuntime === "exec" ? "exec" : "sdk",
): VariantRun {
	return {
		id: "run-1",
		productId: "ribbed-market-tote",
		userId: "user-1",
		status: "succeeded",
		campaignBrief: "Make a commuter campaign.",
		campaignGoal: "Eco-conscious story",
		workspacePath: "/tmp/workspace/run-1/storefront",
		requestedAuthMode: "auto",
		selectedAuthMode: "subscription",
		requestedModel: "gpt-5.5",
		selectedModel: "gpt-5.5",
		requestedEffort: "low",
		selectedEffort: "low",
		agentCore: "codex",
		agentHarness,
		codexRuntime,
		codexCommand,
		inputPrompt: "Prompt sent to Codex.",
		outputSummary: "Done",
		transcript: "",
		stdout: "",
		stderr: "",
		error: null,
		manifest: "",
		changedFiles: "[]",
		validationResult: "Validation: passed",
		previewHtml: "",
		testsPassed: true,
		buildPassed: true,
		commerceInvariantsOk: true,
		startedAt: new Date("2026-05-04T00:00:00Z"),
		completedAt: new Date("2026-05-04T00:01:00Z"),
	};
}

describe("RunReceipt", () => {
	it("renders SDK execution evidence as wrapped monospace code", () => {
		const invocation =
			"Codex TypeScript SDK runStreamed workingDirectory=<isolated-workspace> sandboxMode=workspace-write skipGitRepoCheck=true model=gpt-5.5 modelReasoningEffort=low";
		const markup = renderToStaticMarkup(
			React.createElement(RunReceipt, {
				run: runWithInvocation(invocation),
			}),
		);

		expect(markup).toContain("Run outcome");
		expect(markup).toContain("Agent execution");
		expect(markup).toContain("Harness");
		expect(markup).toContain("Codex SDK");
		expect(markup).toContain("Reasoning effort");
		expect(markup).toContain("Workspace path");
		expect(markup).toContain("/tmp/workspace/run-1/storefront");
		expect(markup).toContain("GPT-5.5 invocation");
		expect(markup).toContain('class="receipt-command"');
		expect(markup).toContain("Codex TypeScript SDK runStreamed");
		expect(markup).toContain("Prompt sent to Codex.");
		expect(markup).toContain("<summary>Manifest</summary>");
		expect(markup).toContain("<summary>Input prompt</summary>");
		expect(markup).toContain('<details class="proof-details" open="">');
		expect(markup).not.toContain("&lt;isolated-workspace&gt;");
	});

	it("renders legacy exec rows from codexRuntime fallback", () => {
		const command =
			'codex exec --json --sandbox workspace-write --skip-git-repo-check --cd <isolated-workspace> -m gpt-5.5 -c model_reasoning_effort="low" -';
		const markup = renderToStaticMarkup(
			React.createElement(RunReceipt, {
				run: runWithInvocation(command, "exec", "sdk"),
			}),
		);

		expect(markup).toContain("codex exec");
		expect(markup).toContain("codex exec --json");
		expect(markup).toContain("trailing <code>-</code> argument");
	});

	it("renders the exec fallback command accurately", () => {
		const command =
			'codex exec --json --sandbox workspace-write --skip-git-repo-check --cd <isolated-workspace> -m gpt-5.5 -c model_reasoning_effort="low" -';
		const markup = renderToStaticMarkup(
			React.createElement(RunReceipt, {
				run: runWithInvocation(command, "exec"),
			}),
		);

		expect(markup).toContain("codex exec");
		expect(markup).toContain("codex exec --json");
		expect(markup).toContain("trailing <code>-</code> argument");
		expect(markup).not.toContain("&lt;isolated-workspace&gt;");
	});
});
