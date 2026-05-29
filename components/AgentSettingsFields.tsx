"use client";

import { PiModelField } from "@/components/PiModelField";
import { CODEX_DEFAULT_REASONING_EFFORT } from "@/lib/agent-defaults";
import type { AgentSettings } from "@/lib/agent-settings-shared";
import { AGENT_CORE_ORDER, agentCoreDefinition } from "@/lib/agent/definitions";

const effortOptions = [
	{ value: CODEX_DEFAULT_REASONING_EFFORT, label: "Default" },
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
	const definition = agentCoreDefinition(settings.agentCore);
	const harnessOptions = definition.harnesses;
	const fixedHarness = harnessOptions.length === 1 ? harnessOptions[0] : null;

	return (
		<div className="agent-settings-fields">
			<p className="muted">
				Agent and model used when you create a variant. Saved to your account.
				Pi runs via <code>pi --mode json</code> (stdin prompt). Cursor runs via{" "}
				<code>@cursor/sdk</code> local agents.
			</p>
			<fieldset className="goal-chips" aria-label="Agent core">
				{AGENT_CORE_ORDER.map((core) => {
					const option = agentCoreDefinition(core);
					return (
						<button
							className={
								settings.agentCore === core ? "chip chip--active" : "chip"
							}
							key={core}
							type="button"
							onClick={() =>
								onChange({
									agentCore: core,
									agentHarness: option.defaultHarness,
								})
							}
						>
							{option.displayName}
						</button>
					);
				})}
			</fieldset>
			{fixedHarness ? (
				<div className="field">
					<span className="field-label">Harness</span>
					<p className="harness-value">{fixedHarness.label}</p>
					<p className="muted field-note">{definition.harnessDescription}</p>
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
			{settings.agentCore === "pi" ? (
				<PiModelField
					value={settings.model}
					onChange={(model) => onChange({ model })}
				/>
			) : definition.modelOptions.length ? (
				<label className="field">
					Model
					<select
						value={settings.model}
						onChange={(event) => onChange({ model: event.target.value })}
					>
						{definition.modelOptions.map((model) => (
							<option key={model} value={model}>
								{model}
							</option>
						))}
					</select>
				</label>
			) : null}
			{definition.showReasoningEffort ? (
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
			{definition.showAuthMode ? (
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
