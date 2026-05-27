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

describe("AgentSettingsFields", () => {
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
