import Link from "next/link";
import type { Product, VariantRun } from "@prisma/client";
import {
	runAgentDisplayLabel,
	workspacePathForDisplay,
} from "@/lib/agent-display";

export function RunHistory({
	runs,
}: {
	runs: Array<VariantRun & { product: Product }>;
}) {
	return (
		<section className="studio-card">
			<h2>Past variant runs</h2>
			{runs.length ? (
				<ul className="history-list">
					{runs.map((run) => (
						<li key={run.id}>
							<Link href={`/runs/${run.id}`}>
								<div>
									<strong>{run.campaignGoal}</strong>
									<span>
										{run.product.name} ·{" "}
										{runAgentDisplayLabel({
											agentCore: run.agentCore,
											selectedModel: run.selectedModel,
										})}
									</span>
									<small>{run.outputSummary || run.campaignBrief}</small>
									<small className="history-workspace">
										{workspacePathForDisplay(run.agentCore, run.workspacePath)}
									</small>
								</div>
								<span className={`status-pill status-pill--${run.status}`}>
									{run.status}
								</span>
							</Link>
						</li>
					))}
				</ul>
			) : (
				<p className="muted">No variant runs yet.</p>
			)}
		</section>
	);
}
