"use client";

import { RunPhaseStepper } from "@/components/RunPhaseStepper";
import { useOptionalRunLiveState } from "@/components/RunLiveProvider";
import { isUsablePreviewHtml } from "@/lib/preview-quality";
import { useMonotonicRunPhase } from "@/components/useMonotonicRunPhase";
import { builtVariantHeading } from "@/lib/agent-display";

function escapeHtml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

export function BeforeAfter({
	beforePreviewHtml,
	previewHtml,
	agentCore = "codex",
	selectedModel = "",
	status: initialStatus = "succeeded",
}: {
	beforePreviewHtml: string;
	previewHtml: string;
	agentCore?: string;
	selectedModel?: string;
	status?: string;
}) {
	const liveState = useOptionalRunLiveState();
	const status = liveState?.status ?? initialStatus;
	const events = liveState?.events ?? [];
	const hasSavedPreview = Boolean(previewHtml?.trim());
	const hasPreview = liveState?.hasPreview ?? isUsablePreviewHtml(previewHtml);
	const afterHeading = builtVariantHeading(agentCore, selectedModel);
	const phase = useMonotonicRunPhase({
		runId: liveState?.runId,
		status,
		agentCore,
		hasPreview,
		events,
	});

	const live = status === "queued" || status === "running";
	const previewPlaceholder = live
		? `<p><strong>Variant preview is not ready.</strong></p><p>Current phase: <strong>${escapeHtml(phase.label)}</strong> (step ${phase.step} of ${phase.total}).</p>`
		: "<p>Variant preview is not ready.</p>";
	const emptyPreviewTitle = hasSavedPreview
		? "Saved preview is incomplete."
		: "Agent did not produce output.";
	const emptyPreviewBody = hasSavedPreview
		? "The run saved a preview artifact, but it is too small to show a usable storefront. Check the Validation and Transcript tabs for details."
		: "No after preview was saved for this run. Check the Validation and Transcript tabs for the failure details.";

	return (
		<div className="preview-grid">
			<section className="preview-pane preview-pane--before">
				<h3>Before: plain storefront template</h3>
				<iframe
					sandbox=""
					title="Original product page"
					srcDoc={beforePreviewHtml}
					tabIndex={-1}
					loading="lazy"
				/>
			</section>
			<section className="preview-pane preview-pane--after">
				<h3>{afterHeading}</h3>
				{live ? <RunPhaseStepper phase={phase} /> : null}
				{!live && !hasPreview ? (
					<div className="preview-empty-state" role="status">
						<strong>{emptyPreviewTitle}</strong>
						<p>{emptyPreviewBody}</p>
					</div>
				) : (
					<iframe
						sandbox="allow-scripts"
						title="Variant product page"
						srcDoc={previewHtml || previewPlaceholder}
						tabIndex={-1}
						loading="lazy"
					/>
				)}
			</section>
		</div>
	);
}
