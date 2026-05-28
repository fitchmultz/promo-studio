import crypto from "node:crypto";
import path from "node:path";
import {
	normalizePiModel,
	piChildEnv as buildPiChildEnv,
	piSessionsPath,
	PI_SECRET_ENV_KEYS,
} from "@/lib/pi-runtime-config";
import { z } from "zod";
import { toProcessEnv } from "@/lib/process-env";
import { WORKSPACE_DIR_NAME } from "@/lib/workspace-constants";

export {
	normalizePiModel,
	parsePiModelSpec,
	piThinkingLevel,
	PI_CHILD_ENV_KEYS,
	PI_DEFAULT_MODEL,
	PI_PROVIDER_ENV_KEYS,
	PI_RUNTIME_ENV_KEYS,
	PI_SECRET_ENV_KEYS,
	selectedPiModel,
	selectedPiThinkingFromModel,
} from "@/lib/pi-runtime-config";
export type { PiModelSpec, PiThinkingLevel } from "@/lib/pi-runtime-config";

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
export const CODEX_DEFAULT_MODEL = "codex-default";
export const CODEX_DEFAULT_REASONING_EFFORT = "codex-default";
const ReasoningEffortSchema = z.enum([
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
const configuredProjectRoot = process.env.PROJECT_ROOT;
// process.cwd() is already absolute; only resolve explicit overrides so all
// child paths share one normalized project-root boundary.
export const projectRoot = configuredProjectRoot
	? path.resolve(/*turbopackIgnore: true*/ configuredProjectRoot)
	: process.cwd();

export const paths = {
	projectRoot,
	artifacts: path.join(projectRoot, "artifacts"),
	piSessions: piSessionsPath(projectRoot),
	templateStorefront: path.join(projectRoot, "templates", "storefront"),
	workspaces: path.join(projectRoot, WORKSPACE_DIR_NAME),
};

export function agentTimeoutMs(core: AgentCore): number {
	return core === "pi" ? env.PI_TIMEOUT_MS : env.CODEX_TIMEOUT_MS;
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
	return buildPiChildEnv(process.env, paths.projectRoot);
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
		...PI_SECRET_ENV_KEYS.map((key) => process.env[key]),
	]) {
		if (value && value.length > 8) {
			redacted = redacted.split(value).join("[REDACTED_API_KEY]");
		}
	}
	return redacted;
}
