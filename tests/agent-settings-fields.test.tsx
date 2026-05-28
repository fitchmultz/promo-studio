/** @vitest-environment jsdom */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AgentSettingsFields } from "@/components/AgentSettingsFields";
import type { AgentSettings } from "@/lib/agent-settings-shared";

vi.mock("@/components/PiModelField", () => ({
	PiModelField: () => "<pi-model />",
}));

const piSettings: AgentSettings = {
	agentCore: "pi",
	agentHarness: "json",
	model: "cursor/composer-2.5",
	reasoningEffort: "codex-default",
	authMode: "auto",
};

const cursorSettings: AgentSettings = {
	agentCore: "cursor",
	agentHarness: "sdk",
	model: "composer-2.5-fast",
	reasoningEffort: "codex-default",
	authMode: "auto",
};

describe("AgentSettingsFields", () => {
	it("shows Cursor SDK chip and default fast model", () => {
		const markup = renderToStaticMarkup(
			<AgentSettingsFields settings={cursorSettings} onChange={() => {}} />,
		);
		expect(markup).toContain("Cursor SDK");
		expect(markup).toContain("composer-2.5-fast");
		expect(markup).toContain("@cursor/sdk");
	});

	it("shows Pi harness help with readable spacing", () => {
		const markup = renderToStaticMarkup(
			<AgentSettingsFields settings={piSettings} onChange={() => {}} />,
		);
		expect(markup).toContain("pi JSON CLI");
		expect(markup).toContain("for example");
		expect(markup).toContain("cursor/composer-2.5");
		expect(markup).toContain("--model");
		expect(markup).not.toContain("for examplecursor");
		expect(markup).not.toContain("via--model");
	});
});
