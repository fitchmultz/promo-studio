import type { VariantRun } from "@prisma/client";
import { agentDisplayName, workspacePathForDisplay } from "@/lib/agent-display";
import { runtimeLabel } from "@/lib/agent/invocation";
import { parseStoredAgentCore, receiptHarness } from "@/lib/agent/stored-run";

function harnessHelp(run: VariantRun) {
	if (run.agentCore === "pi") {
		return (
			<>
				This is the Pi JSON CLI command for this run. The campaign prompt was
				sent on stdin (same as <code>pi --mode json</code> with a piped prompt).
			</>
		);
	}
	if (run.codexRuntime === "exec" || run.agentHarness === "exec") {
		return (
			<>
				This is the command executed for this run. The prompt was sent through
				stdin via the trailing <code>-</code> argument.
			</>
		);
	}
	return "This is the Codex SDK invocation descriptor for this run. The prompt was sent through the Codex TypeScript SDK streaming API.";
}

export function RunReceipt({ run }: { run: VariantRun }) {
	const core = parseStoredAgentCore(run.agentCore);
	const harness = receiptHarness(run);
	const invocation = run.codexCommand.replace(
		"<isolated-workspace>",
		run.workspacePath,
	);
	const effortLabel = core === "pi" ? "Thinking level" : "Reasoning effort";
	const agentName = agentDisplayName(core);
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
						<strong>{core}</strong>
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
						<strong>{run.selectedModel}</strong>
					</div>
					{core === "codex" ? (
						<div className="receipt-card">
							<span>{effortLabel}</span>
							<strong>{run.selectedEffort}</strong>
						</div>
					) : null}
					<div className="receipt-card receipt-card--wide">
						<span>Workspace path</span>
						<code className="receipt-command">{workspaceDisplay}</code>
					</div>
					<div className="receipt-card receipt-card--wide">
						<span>{agentName} invocation</span>
						<p className="receipt-help">{harnessHelp(run)}</p>
						<code className="receipt-command">{invocation}</code>
					</div>
				</div>
			</section>

			<details className="proof-details" open>
				<summary>Validation receipt</summary>
				<pre>{run.validationResult || "Validation is still running."}</pre>
			</details>
			<details className="proof-details" open>
				<summary>Manifest</summary>
				<pre>{run.manifest || "Manifest is not available yet."}</pre>
			</details>
			<details className="proof-details" open>
				<summary>Input prompt</summary>
				<pre>{run.inputPrompt}</pre>
			</details>
		</div>
	);
}
