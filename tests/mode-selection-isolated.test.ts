import { afterEach, describe, expect, it, vi } from "vitest";

describe("Codex subscription-first auth precedence", () => {
	afterEach(() => {
		process.env.CODEX_API_KEY = "";
		process.env.OPENAI_API_KEY = "";
		vi.resetModules();
	});

	it("keeps auto mode on subscription auth even when API keys are present", async () => {
		process.env.CODEX_API_KEY = "codex-key";
		process.env.OPENAI_API_KEY = "openai-key";
		const { resolveCodexAuthState, selectCodexMode } = await import(
			"@/lib/config"
		);
		expect(selectCodexMode("auto")).toEqual({
			selectedMode: "subscription",
			keySource: "none",
		});
		expect(resolveCodexAuthState("auto")).toMatchObject({
			apiKeyFallbackSource: "CODEX_API_KEY",
			childEnvKeySource: "none",
			requestedMode: "auto",
			selectedMode: "subscription",
		});
	});

	it("uses CODEX_API_KEY only for API-key fallback or explicit API-key mode", async () => {
		process.env.CODEX_API_KEY = "codex-key";
		process.env.OPENAI_API_KEY = "openai-key";
		const { selectCodexApiKeyFallbackMode, selectCodexMode } = await import(
			"@/lib/config"
		);
		expect(selectCodexMode("api-key")).toEqual({
			selectedMode: "api-key",
			keySource: "CODEX_API_KEY",
		});
		expect(selectCodexApiKeyFallbackMode()).toEqual({
			selectedMode: "api-key",
			keySource: "CODEX_API_KEY",
		});
	});

	it("maps OPENAI_API_KEY to API-key fallback when CODEX_API_KEY is absent", async () => {
		process.env.OPENAI_API_KEY = "openai-key";
		const { selectCodexApiKeyFallbackMode, selectCodexMode } = await import(
			"@/lib/config"
		);
		expect(selectCodexMode("auto")).toEqual({
			selectedMode: "subscription",
			keySource: "none",
		});
		expect(selectCodexApiKeyFallbackMode()).toEqual({
			selectedMode: "api-key",
			keySource: "OPENAI_API_KEY",
		});
	});
});
