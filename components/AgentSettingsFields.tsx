"use client";

import { useMemo } from "react";
import { PiModelField } from "@/components/PiModelField";
import type { AgentSettings } from "@/lib/agent-settings-storage";

const codexModels = [
	"codex-default",
	"gpt-5.5",
	"gpt-5.5-mini",
	"gpt-5.4-mini",
];
const effortOptions = [
	{ value: "codex-default", label: "Default" },
	{ value: "low", label: "Low" },
	{ value: "medium", label: "Medium" },
	{ value: "high", label: "High" },
];

export function AgentSettingsFields({
	settings,
	onChange,
}: {
	settings: AgentSettings;
	onChange: (patch: Partial<AgentSettings>) => void;
}) {
	const harnessOptions = useMemo(
		() => [
			{ value: "sdk", label: "Codex SDK" },
			{ value: "exec", label: "codex exec" },
		],
		[],
	);

	const modelOptions = codexModels;
	const isPi = settings.agentCore === "pi";

	return (
		<div className="agent-settings-fields">
			<p className="muted">
				Agent and model used when you create a variant. Saved in this browser.
				Pi runs via <code>pi --mode json</code> (stdin prompt).
			</p>
			<fieldset className="goal-chips" aria-label="Agent core">
				<button
					className={
						settings.agentCore === "codex" ? "chip chip--active" : "chip"
					}
					type="button"
					onClick={() => onChange({ agentCore: "codex", agentHarness: "sdk" })}
				>
					Codex
				</button>
				<button
					className={settings.agentCore === "pi" ? "chip chip--active" : "chip"}
					type="button"
					onClick={() => onChange({ agentCore: "pi", agentHarness: "json" })}
				>
					Pi
				</button>
			</fieldset>
			{isPi ? (
				<div className="field">
					<span className="field-label">Harness</span>
					<p className="harness-value">pi JSON CLI</p>
					<p className="muted field-note">
						Pi runs <code>pi --mode json</code> in the isolated storefront. The
						campaign prompt is sent on stdin. Extension models (for example{" "}
						<code>cursor/composer-2.5</code>) are passed via{" "}
						<code>--model</code>.
					</p>
				</div>
			) : (
				<label className="field">
					Harness
					<select
						value={settings.agentHarness}
						onChange={(event) => onChange({ agentHarness: event.target.value })}
					>
						{harnessOptions.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</label>
			)}
			{isPi ? (
				<PiModelField
					value={settings.model}
					onChange={(model) => onChange({ model })}
				/>
			) : (
				<label className="field">
					Model
					<select
						value={settings.model}
						onChange={(event) => onChange({ model: event.target.value })}
					>
						{modelOptions.map((model) => (
							<option key={model} value={model}>
								{model}
							</option>
						))}
					</select>
				</label>
			)}
			{settings.agentCore === "codex" ? (
				<label className="field">
					Reasoning effort
					<select
						value={settings.reasoningEffort}
						onChange={(event) =>
							onChange({ reasoningEffort: event.target.value })
						}
					>
						{effortOptions.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</label>
			) : null}
			{settings.agentCore === "codex" ? (
				<label className="field">
					Auth mode
					<select
						value={settings.authMode}
						onChange={(event) => onChange({ authMode: event.target.value })}
					>
						<option value="auto">Auto (subscription, then API key)</option>
						<option value="subscription">Subscription</option>
						<option value="api-key">API key</option>
					</select>
				</label>
			) : null}
		</div>
	);
}
