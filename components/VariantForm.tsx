"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { useAgentSettings } from "@/components/AgentSettingsProvider";
import { CreateVariantRunResponseSchema } from "@/lib/variant-run-api";

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
const CAMPAIGN_BRIEF_MIN_LENGTH = 12;

function isPresetBrief(brief: string) {
	return presets.some((preset) => preset.brief === brief);
}

export function VariantForm({ productId }: { productId: string }) {
	const router = useRouter();
	const { settings } = useAgentSettings();
	const [goal, setGoal] = useState<string>(defaultPreset.label);
	const [brief, setBrief] = useState<string>(defaultPreset.brief);
	const [error, setError] = useState("");
	const [isPending, startTransition] = useTransition();

	function selectPreset(preset: (typeof presets)[number]) {
		setGoal(preset.label);
		setError("");
		if (isPresetBrief(brief)) setBrief(preset.brief);
	}

	function validateBrief(value: string) {
		if (value.trim().length < CAMPAIGN_BRIEF_MIN_LENGTH) {
			setError("Describe the campaign in at least 12 characters.");
			return false;
		}
		return true;
	}

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const trimmedBrief = brief.trim();
		if (!validateBrief(brief)) return;
		setError("");
		const form = new FormData(event.currentTarget);
		form.set("campaignBrief", trimmedBrief);
		startTransition(async () => {
			const response = await fetch("/api/variant-runs", {
				method: "POST",
				body: form,
			});
			const parsed = CreateVariantRunResponseSchema.safeParse(
				await response.json(),
			);
			const payload = parsed.success ? parsed.data : {};
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
			<input name="agentCore" type="hidden" value={settings.agentCore} />
			<input name="agentHarness" type="hidden" value={settings.agentHarness} />
			<input name="model" type="hidden" value={settings.model} />
			{settings.agentCore === "codex" ? (
				<>
					<input
						name="reasoningEffort"
						type="hidden"
						value={settings.reasoningEffort}
					/>
					<input name="authMode" type="hidden" value={settings.authMode} />
				</>
			) : null}
			<p className="section-kicker">Business intent</p>
			<h2 id="variant-form-title">Create a product page variant</h2>
			<p className="muted">
				Copies the storefront template, edits code, runs tests, builds, and
				saves a receipt.
			</p>
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
					onChange={(event) => {
						setBrief(event.target.value);
						if (
							error &&
							event.target.value.trim().length >= CAMPAIGN_BRIEF_MIN_LENGTH
						) {
							setError("");
						}
					}}
					onInvalid={(event) => {
						event.preventDefault();
						validateBrief(event.currentTarget.value);
					}}
					rows={5}
					required
					minLength={CAMPAIGN_BRIEF_MIN_LENGTH}
					aria-invalid={Boolean(error)}
					aria-describedby={error ? "campaign-brief-error" : undefined}
				/>
			</label>
			{error ? (
				<p className="badge sev-1" id="campaign-brief-error">
					{error}
				</p>
			) : null}
			<button
				className="button primary-button create-button"
				disabled={isPending}
				type="submit"
			>
				{isPending ? "Creating variant…" : "Create Variant"}
			</button>
		</form>
	);
}
