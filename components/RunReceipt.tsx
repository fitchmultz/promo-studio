import type { VariantRun } from "@prisma/client";
import {
	agentDisplayName,
	runAgentDisplayLabel,
	workspacePathForDisplay,
} from "@/lib/agent-display";
import { runtimeLabel } from "@/lib/agent/invocation";
import { agentRuntimeSpecFromStoredRun } from "@/lib/agent/runtime-spec";

function commandHasFlag(command: string, flag: string) {
	return new RegExp(`(?:^|\\s)${flag}(?:\\s|$)`).test(command);
}

function execCommandClaims(command: string) {
	const claims: string[] = [];
	if (commandHasFlag(command, "--json")) claims.push("JSONL output");
	if (commandHasFlag(command, "--ephemeral"))
		claims.push("an ephemeral session");
	if (
		commandHasFlag(command, "--ignore-user-config") &&
		commandHasFlag(command, "--ignore-rules")
	) {
		claims.push("ignored user config/rules");
	}
	if (command.includes("--sandbox workspace-write")) {
		claims.push("workspace-write sandboxing");
	}
	if (
		command.includes('approval_policy="never"') &&
		command.includes("sandbox_workspace_write.network_access=false") &&
		command.includes('web_search="disabled"')
	) {
		claims.push("approvals/network/web search disabled");
	}
	return claims;
}

function harnessHelp(run: VariantRun) {
	if (run.agentCore === "pi") {
		return (
			<>
				This is the Pi JSON CLI command for this run. The campaign prompt was
				sent on stdin (same as <code>pi --mode json</code> with a piped prompt).
			</>
		);
	}
	if (run.agentCore === "cursor" || run.codexRuntime === "cursor-sdk") {
		return (
			<>
				This is the Cursor TypeScript SDK invocation descriptor for this run.
				The campaign prompt was sent through <code>Agent.send</code> against the
				isolated storefront workspace.
			</>
		);
	}
	if (run.codexRuntime === "exec" || run.agentHarness === "exec") {
		const claims = execCommandClaims(run.codexCommand);
		return (
			<>
				This is the exact non-interactive command executed for this run. The
				displayed command is the source of truth
				{claims.length ? `; its flags show ${claims.join(", ")}` : ""}. The
				prompt was sent through stdin via the trailing <code>-</code> argument.
			</>
		);
	}
	return "This is the Codex SDK invocation descriptor for this run. The prompt was sent through the Codex TypeScript SDK streaming API.";
}

export function RunReceipt({
	run,
	detailsOpen = true,
}: {
	run: VariantRun;
	/** When false, collapses large pre blocks (proof page perf). */
	detailsOpen?: boolean;
}) {
	const runtimeSpec = agentRuntimeSpecFromStoredRun(run);
	const core = runtimeSpec.core;
	const harness = runtimeSpec.harness;
	const invocation = run.codexCommand.replace(
		"<isolated-workspace>",
		run.workspacePath,
	);
	const effortLabel = core === "pi" ? "Thinking level" : "Reasoning effort";
	const agentName = runAgentDisplayLabel({
		agentCore: core,
		selectedModel: run.selectedModel,
	});
	const workspaceDisplay = workspacePathForDisplay(core, run.workspacePath);

	return (
		<div className="receipt-stack">
			<section className="receipt-section" aria-labelledby="run-outcome-title">
				<h3 id="run-outcome-title">Run outcome</h3>
				<div className="receipt-grid">
					<div className="receipt-card">
						<span>Status</span>
						<strong>{run.status}</strong>
					</div>
					<div className="receipt-card">
						<span>Tests</span>
						<strong>{run.testsPassed ? "Passed" : "Not passed"}</strong>
					</div>
					<div className="receipt-card">
						<span>Build</span>
						<strong>{run.buildPassed ? "Passed" : "Not passed"}</strong>
					</div>
					<div className="receipt-card">
						<span>Commerce invariants</span>
						<strong>
							{run.commerceInvariantsOk ? "Preserved" : "Not verified"}
						</strong>
					</div>
				</div>
			</section>

			<section
				className="receipt-section"
				aria-labelledby="agent-execution-title"
			>
				<h3 id="agent-execution-title">Agent execution</h3>
				<div className="receipt-grid">
					<div className="receipt-card">
						<span>Core</span>
						<strong>{agentDisplayName(core)}</strong>
					</div>
					<div className="receipt-card">
						<span>Harness</span>
						<strong>{runtimeLabel(core, harness)}</strong>
					</div>
					{core === "codex" ? (
						<div className="receipt-card">
							<span>Auth mode</span>
							<strong>{run.selectedAuthMode}</strong>
						</div>
					) : null}
					<div className="receipt-card">
						<span>Model</span>
						<strong title={run.selectedModel}>{run.selectedModel}</strong>
					</div>
					{core === "codex" ? (
						<div className="receipt-card">
							<span>{effortLabel}</span>
							<strong>{run.selectedEffort}</strong>
						</div>
					) : null}
					<div className="receipt-card receipt-card--wide">
						<span>Workspace path</span>
						<code className="receipt-command" title={workspaceDisplay}>
							{workspaceDisplay}
						</code>
					</div>
					<div className="receipt-card receipt-card--wide">
						<span>{agentName} invocation</span>
						<p className="receipt-help">{harnessHelp(run)}</p>
						<code className="receipt-command" title={invocation}>
							{invocation}
						</code>
					</div>
				</div>
			</section>

			<details className="proof-details" open={detailsOpen || undefined}>
				<summary>Validation receipt</summary>
				<pre>{run.validationResult || "Validation is still running."}</pre>
			</details>
			<details className="proof-details" open={detailsOpen || undefined}>
				<summary>Manifest</summary>
				<pre>{run.manifest || "Manifest is not available yet."}</pre>
			</details>
			<details className="proof-details" open={detailsOpen || undefined}>
				<summary>Input prompt</summary>
				<pre>{run.inputPrompt}</pre>
			</details>
		</div>
	);
}
