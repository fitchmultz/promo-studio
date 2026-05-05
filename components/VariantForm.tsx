"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";

const presets = [
	{
		label: "Holiday gift push",
		brief:
			"Turn the Ribbed Market Tote into the gift they'll actually use every weekday: a premium organic-cotton commuter carryall for coffee runs, laptops, errands, and last-minute holiday gifting. Keep it warm, useful, and low-waste without sounding preachy.",
	},
	{
		label: "Back-to-work launch",
		brief:
			"Reframe the Ribbed Market Tote as the Monday-morning reset bag: structured enough for a laptop and planner, roomy enough for lunch and errands, and polished enough to carry from commute to office to after-work plans.",
	},
	{
		label: "Eco-conscious story",
		brief:
			"Tell a grounded sustainability story for shoppers who are tired of throwaway bags: organic cotton, reinforced handles, washable construction, and one durable tote that makes everyday low-waste habits feel easy.",
	},
	{
		label: "Low-stock urgency",
		brief:
			"Create calm, premium urgency around the Ribbed Market Tote being a small-batch item with only 3 left in stock. Make the page feel decisive and timely, but avoid countdown-timer pressure or gimmicky scarcity copy.",
	},
] as const;

const defaultPreset = presets[0];

function isPresetBrief(brief: string) {
	return presets.some((preset) => preset.brief === brief);
}

export function VariantForm({ productId }: { productId: string }) {
	const router = useRouter();
	const [goal, setGoal] = useState<string>(defaultPreset.label);
	const [brief, setBrief] = useState<string>(defaultPreset.brief);
	const [error, setError] = useState("");
	const [isPending, startTransition] = useTransition();

	function selectPreset(preset: (typeof presets)[number]) {
		setGoal(preset.label);
		if (isPresetBrief(brief)) setBrief(preset.brief);
	}

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError("");
		const form = new FormData(event.currentTarget);
		startTransition(async () => {
			const response = await fetch("/api/variant-runs", {
				method: "POST",
				body: form,
			});
			const payload = (await response.json()) as {
				id?: string;
				error?: string;
			};
			if (!response.ok || !payload.id) {
				setError(payload.error ?? "Variant creation failed.");
				return;
			}
			router.push(`/runs/${payload.id}`);
		});
	}

	return (
		<form
			className="studio-card form-card"
			action="/api/variant-runs"
			method="post"
			onSubmit={submit}
			aria-labelledby="variant-form-title"
		>
			<input name="productId" type="hidden" value={productId} />
			<input name="campaignGoal" type="hidden" value={goal} />
			<p className="section-kicker">Business intent</p>
			<h2 id="variant-form-title">Create a product page variant</h2>
			<p className="muted">
				Codex will copy the storefront template, edit code, run tests, build,
				and save a receipt.
			</p>
			<button
				className="button primary-button create-button"
				disabled={isPending}
				type="submit"
			>
				{isPending ? "Starting Codex..." : "Create Variant"}
			</button>
			<fieldset className="goal-chips" aria-label="Campaign goals">
				{presets.map((preset) => (
					<button
						key={preset.label}
						className={preset.label === goal ? "chip chip--active" : "chip"}
						type="button"
						onClick={() => selectPreset(preset)}
					>
						{preset.label}
					</button>
				))}
			</fieldset>
			<label className="field">
				Campaign brief
				<textarea
					name="campaignBrief"
					value={brief}
					onChange={(event) => setBrief(event.target.value)}
					rows={5}
				/>
			</label>
			{error ? <p className="badge sev-1">{error}</p> : null}
			<button
				className="button secondary-button"
				disabled={isPending}
				type="submit"
			>
				{isPending ? "Starting Codex..." : "Create Variant"}
			</button>
		</form>
	);
}
