"use client";

import { useMemo } from "react";
import { RunPhaseStepper } from "@/components/RunPhaseStepper";
import { useOptionalRunLiveState } from "@/components/RunLiveProvider";
import { builtVariantHeading } from "@/lib/agent-display";
import { inferRunPhase } from "@/lib/run-phase";

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
	const hasPreview = liveState?.hasPreview ?? Boolean(previewHtml?.trim());
	const afterHeading = builtVariantHeading(agentCore, selectedModel);
	const phase = useMemo(
		() =>
			inferRunPhase({
				status,
				agentCore,
				hasPreview,
				events,
			}),
		[status, agentCore, hasPreview, events],
	);

	const live = status === "queued" || status === "running";
	const previewPlaceholder = live
		? `<p><strong>Variant preview is not ready.</strong></p><p>Current phase: <strong>${escapeHtml(phase.label)}</strong> (step ${phase.step} of ${phase.total}).</p>`
		: "<p>Variant preview is not ready.</p>";

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
				<iframe
					sandbox="allow-scripts"
					title="Variant product page"
					srcDoc={previewHtml || previewPlaceholder}
					tabIndex={-1}
					loading="lazy"
				/>
			</section>
		</div>
	);
}
