"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";

const presets = [
	{
		label: "Holiday gift push",
		brief:
			"Make the Ribbed Market Tote feel like the perfect thoughtful gift for commuters who want durable, low-waste everyday carry.",
	},
	{
		label: "Back-to-work launch",
		brief:
			"Position the Ribbed Market Tote as a polished back-to-work carryall for laptops, lunches, books, and after-office errands.",
	},
	{
		label: "Eco-conscious story",
		brief:
			"Tell a warm eco-conscious story about replacing disposable bags with a durable organic cotton tote built for everyday routines.",
	},
	{
		label: "Low-stock urgency",
		brief:
			"Create tasteful urgency around the Ribbed Market Tote being a small-batch item with only 3 left in stock, without sounding pushy.",
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
