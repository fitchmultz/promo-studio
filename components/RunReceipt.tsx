import type { VariantRun } from "@prisma/client";

export function RunReceipt({ run }: { run: VariantRun }) {
	const codexCommand = run.codexCommand.replace(
		"<isolated-workspace>",
		run.workspacePath,
	);

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
				aria-labelledby="codex-execution-title"
			>
				<h3 id="codex-execution-title">Codex execution</h3>
				<div className="receipt-grid">
					<div className="receipt-card">
						<span>Auth mode</span>
						<strong>{run.selectedAuthMode}</strong>
					</div>
					<div className="receipt-card">
						<span>Model</span>
						<strong>{run.selectedModel}</strong>
					</div>
					<div className="receipt-card">
						<span>Reasoning effort</span>
						<strong>{run.selectedEffort}</strong>
					</div>
					<div className="receipt-card receipt-card--wide">
						<span>Workspace path</span>
						<code className="receipt-command">{run.workspacePath}</code>
					</div>
					<div className="receipt-card receipt-card--wide">
						<span>Codex command</span>
						<p className="receipt-help">
							This is the command executed for this run. The prompt was sent
							through stdin via the trailing <code>-</code> argument.
						</p>
						<code className="receipt-command">{codexCommand}</code>
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
