"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product } from "@prisma/client";
import { RunPhaseStepper } from "@/components/RunPhaseStepper";
import { builtVariantHeading } from "@/lib/agent-display";
import { parseFeatures } from "@/lib/products";
import { inferRunPhase } from "@/lib/run-phase";
import { VariantRunPollSchema } from "@/lib/variant-run-api";

function escapeHtml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function beforeHtml(product: Product) {
	const features = parseFeatures(product)
		.map((feature) => `<li>${escapeHtml(feature)}</li>`)
		.join("");
	return `<!doctype html><html><head><style>body{font-family:Arial,sans-serif;margin:0;color:#222;background:#fff}.page{max-width:980px;margin:0 auto;padding:32px 20px}.hero{display:grid;grid-template-columns:1fr 1fr;gap:24px;border-bottom:1px solid #ddd;padding-bottom:24px}.image{display:grid;height:360px;place-items:center;background:#f7f7f7;border:1px solid #ddd;overflow:hidden}.image img{display:block;width:auto;max-width:100%;height:auto;max-height:100%;min-width:0;min-height:0;object-fit:contain}.grid{display:grid;grid-template-columns:1.2fr .8fr;gap:24px;padding-top:24px}.box{border:1px solid #ddd;padding:20px}.price{font-size:28px;font-weight:700}button{width:100%;min-height:44px;border:0;background:#333;color:#fff}</style></head><body><main class="page"><section class="hero"><div class="image"><img src="${escapeHtml(product.imageSrc)}" alt="${escapeHtml(product.name)}"></div><div><p>Everyday carry</p><h1>${escapeHtml(product.name)}</h1><p>${escapeHtml(product.description)}</p></div></section><div class="grid"><section class="box"><h2>Details</h2><ul>${features}</ul><p>SKU: RMT-001</p></section><section class="box"><p class="price">${escapeHtml(product.price)}</p><p>3 left in stock</p><button>Add to cart</button></section></div></main></body></html>`;
}

export function BeforeAfter({
	product,
	previewHtml,
	agentCore = "codex",
	status: initialStatus = "succeeded",
	runId,
}: {
	product: Product;
	previewHtml: string;
	agentCore?: string;
	status?: string;
	/** When set, polls run status to show live phase above the after preview. */
	runId?: string;
}) {
	const [status, setStatus] = useState(initialStatus);
	const [livePreview, setLivePreview] = useState(previewHtml);
	const [pollEvents, setPollEvents] = useState<
		Array<{ type: string; parsed: Record<string, unknown>; raw?: string }>
	>([]);
	const [hasPreview, setHasPreview] = useState(Boolean(previewHtml?.trim()));

	useEffect(() => {
		setStatus(initialStatus);
		setLivePreview(previewHtml);
		setHasPreview(Boolean(previewHtml?.trim()));
	}, [initialStatus, previewHtml]);

	useEffect(() => {
		if (!runId || status !== "running") return undefined;
		let active = true;
		async function poll() {
			const response = await fetch(`/api/variant-runs/${runId}`, {
				cache: "no-store",
			});
			if (!active || !response.ok) return;
			const parsed = VariantRunPollSchema.safeParse(await response.json());
			if (!parsed.success) return;
			setStatus(parsed.data.run.status);
			setHasPreview(parsed.data.run.hasPreview ?? false);
			setPollEvents(parsed.data.events);
		}
		void poll();
		const timer = setInterval(() => void poll(), 1500);
		return () => {
			active = false;
			clearInterval(timer);
		};
	}, [runId, status]);

	const afterHeading = builtVariantHeading(agentCore);
	const phase = useMemo(
		() =>
			inferRunPhase({
				status,
				agentCore,
				hasPreview,
				events: pollEvents,
			}),
		[status, agentCore, hasPreview, pollEvents],
	);

	const previewPlaceholder =
		status === "running"
			? `<p><strong>Variant preview is not ready.</strong></p><p>Current phase: <strong>${escapeHtml(phase.label)}</strong> (step ${phase.step} of ${phase.total}).</p>`
			: "<p>Variant preview is not ready.</p>";

	return (
		<div className="preview-grid">
			<section className="preview-pane preview-pane--before">
				<h3>Before: plain storefront template</h3>
				<iframe
					sandbox=""
					title="Original product page"
					srcDoc={beforeHtml(product)}
					tabIndex={-1}
					loading="lazy"
				/>
			</section>
			<section className="preview-pane preview-pane--after">
				<h3>{afterHeading}</h3>
				{status === "running" ? <RunPhaseStepper phase={phase} /> : null}
				<iframe
					sandbox="allow-scripts"
					title="Variant product page"
					srcDoc={livePreview || previewPlaceholder}
					tabIndex={-1}
					loading="lazy"
				/>
			</section>
		</div>
	);
}
