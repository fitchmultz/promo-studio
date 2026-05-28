import { spawnSync } from "node:child_process";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	agentTimeoutMs,
	codexChildEnv,
	env,
	normalizeCodexModel,
	normalizeCodexReasoningEffort,
	normalizeCursorModel,
	normalizePiModel,
	parseCursorModelSelection,
	selectedCursorModel,
	paths,
	piChildEnv,
	redactSecrets,
	parsePiModelSpec,
	selectCodexMode,
} from "@/lib/config";

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;
const ORIGINAL_SESSION_SECRET = process.env.SESSION_SECRET;

afterEach(() => {
	process.env.CODEX_API_KEY = "";
	delete process.env.GEMINI_API_KEY;
	if (ORIGINAL_DATABASE_URL === undefined) {
		delete process.env.DATABASE_URL;
	} else {
		process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
	}
	if (ORIGINAL_SESSION_SECRET === undefined) {
		delete process.env.SESSION_SECRET;
	} else {
		process.env.SESSION_SECRET = ORIGINAL_SESSION_SECRET;
	}
});

describe("Codex auth mode selection", () => {
	it("uses a stable non-default session secret when local env omits one", () => {
		expect(env.SESSION_SECRET).not.toBe("dev-session-secret-change-me");
		expect(env.SESSION_SECRET).not.toBe(
			"replace-with-a-long-random-local-secret",
		);
		expect(env.SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
		// The secret is derived from the hardcoded fallback + HOME path.
		expect(env.SESSION_SECRET).not.toBe("");
	});

	it("uses subscription when explicitly requested", () => {
		expect(selectCodexMode("subscription")).toEqual({
			selectedMode: "subscription",
			keySource: "none",
		});
	});

	it("uses subscription by default for auto mode", () => {
		expect(selectCodexMode("auto")).toEqual({
			selectedMode: "subscription",
			keySource: "none",
		});
	});

	it("uses the configured default auth mode from env", () => {
		expect(env.CODEX_AUTH_MODE).toBe("auto");
	});

	it("defaults agent core and Codex runtime, model, and reasoning to configured settings", () => {
		expect(env.AGENT_CORE).toBe("codex");
		expect(env.CODEX_RUNTIME).toBe("sdk");
		expect(env.CODEX_MODEL).toBe("gpt-5.5");
		expect(env.CODEX_REASONING_EFFORT).toBe("low");
	});

	it("normalizes relative PROJECT_ROOT once before deriving child paths", () => {
		const tsxBin = path.join(
			process.cwd(),
			"node_modules",
			".bin",
			process.platform === "win32" ? "tsx.cmd" : "tsx",
		);
		const result = spawnSync(
			tsxBin,
			[
				"-e",
				`import { projectRoot, paths } from "./lib/config.ts";
console.log(JSON.stringify({
	projectRoot,
	artifacts: paths.artifacts,
	piSessions: paths.piSessions,
	templateStorefront: paths.templateStorefront,
	workspaces: paths.workspaces,
}));`,
			],
			{
				env: {
					...process.env,
					PROJECT_ROOT: "relative-root",
					SESSION_SECRET: "relative-root-test-session-secret",
				},
				encoding: "utf8",
			},
		);
		const expectedRoot = path.resolve("relative-root");

		if (result.status !== 0) {
			throw new Error(result.stderr || result.stdout);
		}
		expect(JSON.parse(result.stdout)).toEqual({
			projectRoot: expectedRoot,
			artifacts: path.join(expectedRoot, "artifacts"),
			piSessions: path.join(expectedRoot, "artifacts", "pi-sessions"),
			templateStorefront: path.join(expectedRoot, "templates", "storefront"),
			workspaces: path.join(expectedRoot, "agent-workspaces"),
		});
	});

	it("parses Pi model refs and Pi CLI model patterns with optional thinking suffix", () => {
		expect(parsePiModelSpec("openai-codex/gpt-5.5:low")).toEqual({
			provider: "openai-codex",
			modelId: "gpt-5.5",
			thinking: "low",
			cliModel: "openai-codex/gpt-5.5:low",
		});
		expect(parsePiModelSpec("cursor/composer-2.5")).toEqual({
			provider: "cursor",
			modelId: "composer-2.5",
			thinking: "",
			cliModel: "cursor/composer-2.5",
		});
		expect(parsePiModelSpec("sonnet:high")).toEqual({
			provider: "",
			modelId: "sonnet",
			thinking: "high",
			cliModel: "sonnet:high",
		});
		expect(parsePiModelSpec("openai/gpt-5.5:off")).toMatchObject({
			thinking: "off",
			cliModel: "openai/gpt-5.5:off",
		});
		expect(
			parsePiModelSpec("anthropic/claude-sonnet-4-20250514").cliModel,
		).toBe("anthropic/claude-sonnet-4-20250514");
		expect(normalizePiModel("openai-codex/gpt-5.5:medium")).toBe(
			"openai-codex/gpt-5.5:medium",
		);
	});

	it("uses dedicated timeouts per agent core", () => {
		expect(agentTimeoutMs("codex")).toBe(env.CODEX_TIMEOUT_MS);
		expect(agentTimeoutMs("pi")).toBe(env.PI_TIMEOUT_MS);
		expect(agentTimeoutMs("cursor")).toBe(env.CURSOR_TIMEOUT_MS);
	});

	it("normalizes Cursor model overrides and default selection", () => {
		expect(normalizeCursorModel("composer-2.5")).toBe("composer-2.5");
		expect(normalizeCursorModel("cursor-default")).toBe("");
		expect(selectedCursorModel("")).toBe("composer-2.5-fast");
		expect(parseCursorModelSelection("")).toEqual({
			id: "composer-2.5",
			params: [{ id: "fast", value: "true" }],
		});
		expect(parseCursorModelSelection("composer-2.5-fast")).toEqual({
			id: "composer-2.5",
			params: [{ id: "fast", value: "true" }],
		});
		expect(parseCursorModelSelection("composer-2.5")).toEqual({
			id: "composer-2.5",
			params: [{ id: "fast", value: "false" }],
		});
	});

	it("rejects unsafe Cursor model ids", () => {
		expect(() => normalizeCursorModel("composer;rm")).toThrow();
	});

	it("normalizes Codex model overrides", () => {
		expect(normalizeCodexModel("gpt-5.4-mini")).toBe("gpt-5.4-mini");
		expect(normalizeCodexModel("codex-default")).toBe("");
	});

	it("rejects unsafe Codex model names", () => {
		expect(() => normalizeCodexModel("gpt-5.4;rm -rf .")).toThrow();
	});

	it("normalizes Codex reasoning effort overrides", () => {
		expect(normalizeCodexReasoningEffort("high")).toBe("high");
		expect(normalizeCodexReasoningEffort("codex-default")).toBe("");
	});

	it("rejects unsupported Codex reasoning effort values", () => {
		expect(() => normalizeCodexReasoningEffort("extreme")).toThrow();
	});

	it("redacts configured API key material from transcripts", () => {
		process.env.CODEX_API_KEY = "sk-test-redaction-value";
		process.env.CURSOR_API_KEY = "cursor-test-redaction-value";
		process.env.GEMINI_API_KEY = "gemini-test-redaction-value";
		expect(
			redactSecrets(
				"codex=sk-test-redaction-value gemini=gemini-test-redaction-value",
			),
		).not.toContain("sk-test-redaction-value");
		expect(
			redactSecrets(
				"codex=sk-test-redaction-value gemini=gemini-test-redaction-value",
			),
		).not.toContain("gemini-test-redaction-value");
		expect(redactSecrets("cursor=cursor-test-redaction-value")).not.toContain(
			"cursor-test-redaction-value",
		);
	});

	it("scopes Codex child process environments to safe runtime context", () => {
		const childEnv = codexChildEnv("none");

		expect(childEnv.PROJECT_ROOT).toBe(paths.projectRoot);
		expect(childEnv.DATABASE_URL).toBeUndefined();
		expect(childEnv.SESSION_SECRET).toBeUndefined();
		expect(childEnv.OPENAI_API_KEY).toBeUndefined();
	});

	it("does not expose home auth paths when API-key auth is selected", () => {
		const childEnv = codexChildEnv("CODEX_API_KEY");

		expect(childEnv.HOME).toBeUndefined();
		expect(childEnv.CODEX_HOME).toBeUndefined();
	});

	it("scopes Pi child process environments to Pi runtime and provider auth", () => {
		process.env.GEMINI_API_KEY = "gemini-test-child-env";
		process.env.DATABASE_URL = "file:private.db";
		process.env.SESSION_SECRET = "private-session-secret-value";

		const childEnv = piChildEnv();

		expect(childEnv.PROJECT_ROOT).toBe(paths.projectRoot);
		expect(childEnv.HOME).toBe(process.env.HOME);
		expect(childEnv.GEMINI_API_KEY).toBe("gemini-test-child-env");
		expect(childEnv.DATABASE_URL).toBeUndefined();
		expect(childEnv.SESSION_SECRET).toBeUndefined();
	});
});
