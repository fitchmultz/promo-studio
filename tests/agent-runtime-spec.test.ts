import { describe, expect, it } from "vitest";
import {
	agentRuntimeSpecFromStoredRun,
	resolveAgentRuntimeSpec,
	resolveAgentRuntimeSpecFromForm,
} from "@/lib/agent/runtime-spec";

describe("agent runtime spec", () => {
	it("normalizes Codex form selection into one execution spec", () => {
		const form = new FormData();
		form.set("agentCore", "codex");
		form.set("agentHarness", "exec");
		form.set("authMode", "api-key");
		form.set("model", "gpt-5.5-mini");
		form.set("reasoningEffort", "medium");

		expect(resolveAgentRuntimeSpecFromForm(form)).toEqual({
			core: "codex",
			harness: "exec",
			requestedAuthMode: "api-key",
			requestedModel: "gpt-5.5-mini",
			requestedEffort: "medium",
			selectedModel: "gpt-5.5-mini",
			selectedEffort: "medium",
			legacyRuntime: "exec",
		});
	});

	it("forces Pi to the JSON harness and derives thinking from the model", () => {
		expect(
			resolveAgentRuntimeSpec({
				core: "pi",
				harness: "sdk",
				model: "openai-codex/gpt-5.5:high",
			}),
		).toEqual({
			core: "pi",
			harness: "json",
			requestedAuthMode: "auto",
			requestedModel: "openai-codex/gpt-5.5:high",
			requestedEffort: "",
			selectedModel: "openai-codex/gpt-5.5:high",
			selectedEffort: "high",
			legacyRuntime: "json",
		});
	});

	it("rejects invalid supplied values in strict mode", () => {
		expect(() =>
			resolveAgentRuntimeSpec(
				{
					core: "codex",
					harness: "json",
					model: "gpt-5.5",
					effort: "low",
				},
				{ strict: true },
			),
		).toThrow("Invalid Codex harness");
	});

	it("reconstructs stored default sentinels for execution", () => {
		expect(
			agentRuntimeSpecFromStoredRun({
				agentCore: "codex",
				agentHarness: "sdk",
				requestedAuthMode: "auto",
				requestedModel: "codex-default",
				requestedEffort: "codex-default",
				selectedModel: "gpt-5.5",
				selectedEffort: "low",
			}),
		).toMatchObject({
			core: "codex",
			harness: "sdk",
			requestedModel: "",
			requestedEffort: "",
			selectedModel: "gpt-5.5",
			selectedEffort: "low",
		});
	});
});
