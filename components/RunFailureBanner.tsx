import Link from "next/link";

export function RunFailureBanner({
	error,
	runId,
}: {
	error: string | null;
	runId: string;
}) {
	if (!error?.trim()) {
		return (
			<div className="run-failure-banner" role="alert">
				<strong>Run failed</strong>
				<p className="muted">
					The agent did not complete the variant. Check the activity stream and
					transcript for details.
				</p>
				<Link className="button secondary-button" href="/studio">
					Start a new variant
				</Link>
			</div>
		);
	}
	return (
		<div className="run-failure-banner" role="alert">
			<strong>Run failed</strong>
			<p>{error}</p>
			<div className="run-failure-actions">
				<Link className="button secondary-button" href="/studio">
					Try again in Studio
				</Link>
				<Link className="text-link" href={`/runs/${runId}`}>
					Refresh this run
				</Link>
			</div>
		</div>
	);
}
