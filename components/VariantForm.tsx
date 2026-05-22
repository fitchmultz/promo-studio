"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState, useTransition } from "react";
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

const codexModels = [
	"codex-default",
	"gpt-5.5",
	"gpt-5.5-mini",
	"gpt-5.4-mini",
];
const piModels = [
	"pi-default",
	"openai-codex/gpt-5.5",
	"openai-codex/gpt-5.5:low",
	"anthropic/claude-sonnet-4-20250514",
	"anthropic/claude-sonnet-4-20250514:medium",
];
const effortOptions = [
	{ value: "codex-default", label: "Default" },
	{ value: "low", label: "Low" },
	{ value: "medium", label: "Medium" },
	{ value: "high", label: "High" },
];

function isPresetBrief(brief: string) {
	return presets.some((preset) => preset.brief === brief);
}

export function VariantForm({ productId }: { productId: string }) {
	const router = useRouter();
	const [goal, setGoal] = useState<string>(defaultPreset.label);
	const [brief, setBrief] = useState<string>(defaultPreset.brief);
	const [agentCore, setAgentCore] = useState<"codex" | "pi">("codex");
	const [agentHarness, setAgentHarness] = useState("sdk");
	const [error, setError] = useState("");
	const [isPending, startTransition] = useTransition();

	const harnessOptions = useMemo(() => {
		if (agentCore === "pi") {
			return [
				{ value: "sdk", label: "Pi SDK" },
				{ value: "json", label: "Pi JSON CLI" },
			];
		}
		return [
			{ value: "sdk", label: "Codex SDK" },
			{ value: "exec", label: "codex exec" },
		];
	}, [agentCore]);

	const modelOptions = agentCore === "pi" ? piModels : codexModels;

	function selectPreset(preset: (typeof presets)[number]) {
		setGoal(preset.label);
		if (isPresetBrief(brief)) setBrief(preset.brief);
	}

	function onCoreChange(core: "codex" | "pi") {
		setAgentCore(core);
		setAgentHarness("sdk");
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

	const agentLabel = agentCore === "pi" ? "Pi" : "Codex";

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
			<input name="agentCore" type="hidden" value={agentCore} />
			<input name="agentHarness" type="hidden" value={agentHarness} />
			<p className="section-kicker">Business intent</p>
			<h2 id="variant-form-title">Create a product page variant</h2>
			<p className="muted">
				The selected agent copies the storefront template, edits code, runs
				tests, builds, and saves a receipt.
			</p>
			<fieldset className="goal-chips" aria-label="Agent core">
				<button
					className={agentCore === "codex" ? "chip chip--active" : "chip"}
					type="button"
					onClick={() => onCoreChange("codex")}
				>
					Codex
				</button>
				<button
					className={agentCore === "pi" ? "chip chip--active" : "chip"}
					type="button"
					onClick={() => onCoreChange("pi")}
				>
					Pi
				</button>
			</fieldset>
			<label className="field">
				Harness
				<select
					value={agentHarness}
					onChange={(event) => setAgentHarness(event.target.value)}
				>
					{harnessOptions.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
			</label>
			<label className="field">
				Model
				<select name="model" defaultValue={modelOptions[0]}>
					{modelOptions.map((model) => (
						<option key={model} value={model}>
							{model}
						</option>
					))}
				</select>
				{agentCore === "pi" ? (
					<p className="muted">
						Pi models use <code>provider/model</code> or{" "}
						<code>provider/model:thinking</code> (e.g.{" "}
						<code>openai-codex/gpt-5.5:low</code>).
					</p>
				) : null}
			</label>
			{agentCore === "codex" ? (
				<label className="field">
					Reasoning effort
					<select name="reasoningEffort" defaultValue={effortOptions[0].value}>
						{effortOptions.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</label>
			) : null}
			{agentCore === "codex" ? (
				<label className="field">
					Auth mode
					<select name="authMode" defaultValue="auto">
						<option value="auto">Auto (subscription, then API key)</option>
						<option value="subscription">Subscription</option>
						<option value="api-key">API key</option>
					</select>
				</label>
			) : null}
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
				className="button primary-button create-button"
				disabled={isPending}
				type="submit"
			>
				{isPending ? `Starting ${agentLabel}...` : "Create Variant"}
			</button>
		</form>
	);
}
