import crypto from "node:crypto";
import path from "node:path";
import { z } from "zod";

const LOCAL_DEMO_SESSION_SECRET =
	"promo-studio-local-demo-session-secret-for-demo-runs";
const UNSAFE_SESSION_SECRET_DEFAULTS = new Set([
	"",
	"dev-session-secret-change-me",
	"replace-with-a-long-random-local-secret",
]);

function normalizeSessionSecret(value: NodeJS.ProcessEnv[string]) {
	const secret = value?.trim() ?? "";
	return UNSAFE_SESSION_SECRET_DEFAULTS.has(secret) ? undefined : secret;
}

function deriveLocalSecret() {
	// Derive a machine-specific fallback so the hardcoded demo secret is never
	// used directly. This keeps zero-friction setup (no .env required) while
	// preventing trivial session forgery on shared machines.
	const fallback = LOCAL_DEMO_SESSION_SECRET;
	const home = process.env.HOME || process.env.USERPROFILE || "promo-studio";
	const hash = crypto
		.createHash("sha256")
		.update(`${fallback}:${home}`)
		.digest("base64url");
	return hash.slice(0, 48);
}

const EnvSchema = z.object({
	DATABASE_URL: z.string().default("file:./dev.db"),
	SESSION_SECRET: z.string().min(32).default(deriveLocalSecret()),
	AGENT_CORE: z.enum(["codex", "pi"]).default("codex"),
	AGENT_HARNESS: z.string().default(""),
	CODEX_AUTH_MODE: z.enum(["auto", "subscription", "api-key"]).default("auto"),
	CODEX_RUNTIME: z.enum(["sdk", "exec"]).default("sdk"),
	CODEX_MODEL: z.string().default("gpt-5.5"),
	CODEX_REASONING_EFFORT: z.string().default("low"),
	PI_MODEL: z.string().default(""),
	ANTHROPIC_API_KEY: z.string().optional(),
	OPENAI_API_KEY: z.string().optional(),
	CODEX_API_KEY: z.string().optional(),
	CODEX_TIMEOUT_MS: z.coerce.number().int().positive().default(300000),
	PI_TIMEOUT_MS: z.coerce.number().int().positive().default(300000),
	NODE_ENV: z.string().optional(),
});

export type AgentCore = "codex" | "pi";
export type AgentHarness = "sdk" | "exec" | "json";
export type CodexAuthMode = "auto" | "subscription" | "api-key";
export type CodexRuntime = "sdk" | "exec";
export type SelectedCodexAuthMode = "subscription" | "api-key";
export type CodexReasoningEffort =
	| "minimal"
	| "low"
	| "medium"
	| "high"
	| "xhigh";
/** Pi SDK thinking levels (includes off; matches pi-agent-core ThinkingLevel). */
export type PiThinkingLevel = "off" | CodexReasoningEffort;
export const CODEX_DEFAULT_MODEL = "codex-default";
export const CODEX_DEFAULT_REASONING_EFFORT = "codex-default";
export const PI_DEFAULT_MODEL = "pi-default";
const ReasoningEffortSchema = z.enum([
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
]);
const PiThinkingLevelSchema = z.enum([
	"off",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
]);
const ModelOverrideSchema = z
	.string()
	.trim()
	.max(80)
	.regex(
		/^[a-zA-Z0-9._:/-]+$/,
		"Model names may contain only letters, numbers, dots, underscores, colons, slashes, and hyphens.",
	);

export const env = EnvSchema.parse({
	...process.env,
	SESSION_SECRET: normalizeSessionSecret(process.env.SESSION_SECRET),
});
export const projectRoot = process.env.PROJECT_ROOT ?? process.cwd();

export const paths = {
	projectRoot,
	artifacts: path.join(projectRoot, "artifacts"),
	piSessions: path.join(projectRoot, "artifacts", "pi-sessions"),
	templateStorefront: path.join(projectRoot, "templates", "storefront"),
	workspaces: path.join(projectRoot, "agent-workspaces"),
};

export function resolveRequestedMode(
	input: FormData | URLSearchParams | null,
): CodexAuthMode {
	const raw = input?.get("authMode");
	if (raw === "subscription" || raw === "api-key" || raw === "auto") return raw;
	return env.CODEX_AUTH_MODE;
}

export function normalizePiModel(
	raw: FormDataEntryValue | string | null | undefined,
): string {
	const value = String(raw ?? "").trim();
	if (!value || value === PI_DEFAULT_MODEL) return "";
	return ModelOverrideSchema.parse(value);
}

export interface PiModelSpec {
	provider: string;
	modelId: string;
	thinking: CodexReasoningEffort | "";
	/** Full Pi CLI model ref, e.g. openai-codex/gpt-5.5:low */
	cliModel: string;
}

function parsePiThinkingSuffix(value: string): {
	modelId: string;
	thinking: CodexReasoningEffort | "";
} {
	const colon = value.lastIndexOf(":");
	if (colon === -1) return { modelId: value, thinking: "" };
	const suffix = value.slice(colon + 1);
	const parsed = ReasoningEffortSchema.safeParse(suffix);
	if (!parsed.success) return { modelId: value, thinking: "" };
	return { modelId: value.slice(0, colon), thinking: parsed.data };
}

/** Parse PI_MODEL as provider/model or provider/model:thinking (Pi CLI format). */
export function parsePiModelSpec(requestedModel: string): PiModelSpec {
	const value = String(requestedModel ?? "").trim();
	if (!value) {
		return { provider: "", modelId: "", thinking: "", cliModel: "" };
	}
	const slash = value.indexOf("/");
	if (slash === -1) {
		throw new Error(
			`PI_MODEL must be provider/model or provider/model:thinking (got "${value}").`,
		);
	}
	const provider = value.slice(0, slash);
	const rest = value.slice(slash + 1);
	const { modelId, thinking } = parsePiThinkingSuffix(rest);
	const cliModel = thinking
		? `${provider}/${modelId}:${thinking}`
		: `${provider}/${modelId}`;
	return { provider, modelId, thinking, cliModel };
}

/** @deprecated Use parsePiModelSpec */
export function parsePiModelRef(requestedModel: string): {
	provider: string;
	modelId: string;
} {
	const spec = parsePiModelSpec(requestedModel);
	return { provider: spec.provider, modelId: spec.modelId };
}

export function resolveRequestedPiModel(
	input: FormData | URLSearchParams | null,
): string {
	const raw = input?.get("model");
	return normalizePiModel(raw ?? env.PI_MODEL);
}

export function selectedPiModel(requestedModel: string): string {
	return requestedModel || PI_DEFAULT_MODEL;
}

export function selectedPiThinkingFromModel(requestedModel: string): string {
	if (!requestedModel || requestedModel === PI_DEFAULT_MODEL) {
		return "default";
	}
	const { thinking } = parsePiModelSpec(requestedModel);
	return thinking || "default";
}

export function agentTimeoutMs(core: AgentCore): number {
	return core === "pi" ? env.PI_TIMEOUT_MS : env.CODEX_TIMEOUT_MS;
}

export function piThinkingLevel(
	thinking: CodexReasoningEffort | "",
): PiThinkingLevel {
	if (!thinking) return "low";
	const parsed = PiThinkingLevelSchema.safeParse(thinking);
	return parsed.success ? parsed.data : "low";
}

export function normalizeCodexModel(
	raw: FormDataEntryValue | string | null | undefined,
): string {
	const value = String(raw ?? "").trim();
	if (!value || value === CODEX_DEFAULT_MODEL) return "";
	return ModelOverrideSchema.parse(value);
}

export function normalizeCodexReasoningEffort(
	raw: FormDataEntryValue | string | null | undefined,
): CodexReasoningEffort | "" {
	const value = String(raw ?? "").trim();
	if (!value || value === CODEX_DEFAULT_REASONING_EFFORT) return "";
	return ReasoningEffortSchema.parse(value);
}

export function resolveRequestedModel(
	input: FormData | URLSearchParams | null,
): string {
	const raw = input?.get("model");
	return normalizeCodexModel(raw ?? env.CODEX_MODEL);
}

export function resolveRequestedReasoningEffort(
	input: FormData | URLSearchParams | null,
): CodexReasoningEffort | "" {
	const raw = input?.get("reasoningEffort");
	return normalizeCodexReasoningEffort(raw ?? env.CODEX_REASONING_EFFORT);
}

export function selectedCodexModel(requestedModel: string): string {
	return requestedModel || CODEX_DEFAULT_MODEL;
}

export function selectedCodexReasoningEffort(
	requestedReasoningEffort: string,
): string {
	return requestedReasoningEffort || CODEX_DEFAULT_REASONING_EFFORT;
}

export function codexModelArgs(requestedModel: string): string[] {
	return requestedModel ? ["-m", requestedModel] : [];
}

export function codexReasoningArgs(requestedReasoningEffort: string): string[] {
	return requestedReasoningEffort
		? [
				"-c",
				`model_reasoning_effort=${JSON.stringify(requestedReasoningEffort)}`,
			]
		: [];
}

export type CodexKeySource = "CODEX_API_KEY" | "OPENAI_API_KEY" | "none";
export type CodexSubscriptionAuthSource = "CODEX_HOME" | "HOME" | "none";
export interface CodexSelection {
	selectedMode: SelectedCodexAuthMode;
	keySource: CodexKeySource;
}

export interface CodexAuthState extends CodexSelection {
	requestedMode: CodexAuthMode;
	childEnvKeySource: CodexKeySource;
	apiKeyFallbackSource: CodexKeySource;
	subscriptionAuthSource: CodexSubscriptionAuthSource;
}

function availableCodexApiKeySource(): CodexKeySource {
	if (env.CODEX_API_KEY) return "CODEX_API_KEY";
	if (env.OPENAI_API_KEY) return "OPENAI_API_KEY";
	return "none";
}

function subscriptionAuthSource(): CodexSubscriptionAuthSource {
	if (process.env.CODEX_HOME) return "CODEX_HOME";
	if (process.env.HOME) return "HOME";
	return "none";
}

export function resolveCodexAuthState(
	requested: CodexAuthMode = env.CODEX_AUTH_MODE,
): CodexAuthState {
	const apiKeyFallbackSource = availableCodexApiKeySource();
	const selectedMode = requested === "api-key" ? "api-key" : "subscription";
	const keySource = selectedMode === "api-key" ? apiKeyFallbackSource : "none";
	return {
		requestedMode: requested,
		selectedMode,
		keySource,
		childEnvKeySource: keySource,
		apiKeyFallbackSource,
		subscriptionAuthSource: subscriptionAuthSource(),
	};
}

export function selectCodexMode(requested: CodexAuthMode): CodexSelection {
	const { selectedMode, keySource } = resolveCodexAuthState(requested);
	return { selectedMode, keySource };
}

function toProcessEnv(
	record: Record<string, string | undefined>,
): NodeJS.ProcessEnv {
	const entries = Object.entries(record).filter(
		(entry): entry is [string, string] => typeof entry[1] === "string",
	);
	return Object.fromEntries(entries) as NodeJS.ProcessEnv;
}

export function selectCodexApiKeyFallbackMode(): {
	selectedMode: "api-key";
	keySource: CodexKeySource;
} {
	return {
		selectedMode: "api-key",
		keySource: resolveCodexAuthState("api-key").keySource,
	};
}

export function codexChildEnv(
	keySource: "CODEX_API_KEY" | "OPENAI_API_KEY" | "none",
) {
	const childEnv: Record<string, string | undefined> = {
		PATH: process.env.PATH,
		USER: process.env.USER,
		LOGNAME: process.env.LOGNAME,
		SHELL: process.env.SHELL,
		LANG: process.env.LANG,
		LC_ALL: process.env.LC_ALL,
		TERM: process.env.TERM,
		TMPDIR: process.env.TMPDIR,
		PROJECT_ROOT: paths.projectRoot,
	};
	if (keySource === "none" && process.env.HOME) {
		childEnv.HOME = process.env.HOME;
	}
	if (keySource === "none" && process.env.CODEX_HOME)
		childEnv.CODEX_HOME = process.env.CODEX_HOME;
	if (keySource === "CODEX_API_KEY" && env.CODEX_API_KEY)
		childEnv.CODEX_API_KEY = env.CODEX_API_KEY;
	if (keySource === "OPENAI_API_KEY" && env.OPENAI_API_KEY)
		childEnv.CODEX_API_KEY = env.OPENAI_API_KEY;
	return toProcessEnv(childEnv);
}

export function piChildEnv() {
	const childEnv: Record<string, string | undefined> = {
		PATH: process.env.PATH,
		USER: process.env.USER,
		LOGNAME: process.env.LOGNAME,
		SHELL: process.env.SHELL,
		LANG: process.env.LANG,
		LC_ALL: process.env.LC_ALL,
		TERM: process.env.TERM,
		TMPDIR: process.env.TMPDIR,
		PROJECT_ROOT: paths.projectRoot,
		HOME: process.env.HOME,
	};
	if (env.ANTHROPIC_API_KEY) childEnv.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
	if (env.OPENAI_API_KEY) childEnv.OPENAI_API_KEY = env.OPENAI_API_KEY;
	return toProcessEnv(childEnv);
}

export function redactSecrets(text: string): string {
	let redacted = text;
	for (const value of [
		env.CODEX_API_KEY,
		env.OPENAI_API_KEY,
		env.ANTHROPIC_API_KEY,
		process.env.CODEX_API_KEY,
		process.env.OPENAI_API_KEY,
		process.env.ANTHROPIC_API_KEY,
	]) {
		if (value && value.length > 8) {
			redacted = redacted.split(value).join("[REDACTED_API_KEY]");
		}
	}
	return redacted;
}
