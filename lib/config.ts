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
	CODEX_AUTH_MODE: z.enum(["auto", "subscription", "api-key"]).default("auto"),
	CODEX_MODEL: z.string().default("gpt-5.5"),
	CODEX_REASONING_EFFORT: z.string().default("low"),
	CODEX_API_KEY: z.string().optional(),
	OPENAI_API_KEY: z.string().optional(),
	CODEX_TIMEOUT_MS: z.coerce.number().int().positive().default(300000),
	NODE_ENV: z.string().optional(),
});

export type CodexAuthMode = "auto" | "subscription" | "api-key";
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
export const projectRoot = process.env.PROJECT_ROOT ?? process.cwd();

export const paths = {
	projectRoot,
	artifacts: path.join(projectRoot, "artifacts"),
	templateStorefront: path.join(projectRoot, "templates", "storefront"),
	workspaces: path.join(projectRoot, "codex-workspaces"),
};

export function resolveRequestedMode(
	input: FormData | URLSearchParams | null,
): CodexAuthMode {
	const raw = input?.get("authMode");
	if (raw === "subscription" || raw === "api-key" || raw === "auto") return raw;
	return env.CODEX_AUTH_MODE;
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

export function selectCodexMode(requested: CodexAuthMode): {
	selectedMode: SelectedCodexAuthMode;
	keySource: "CODEX_API_KEY" | "OPENAI_API_KEY" | "none";
} {
	if (requested === "api-key") {
		if (env.CODEX_API_KEY)
			return { selectedMode: "api-key", keySource: "CODEX_API_KEY" };
		if (env.OPENAI_API_KEY)
			return { selectedMode: "api-key", keySource: "OPENAI_API_KEY" };
		return { selectedMode: "api-key", keySource: "none" };
	}
	return { selectedMode: "subscription", keySource: "none" };
}

export function selectCodexApiKeyFallbackMode(): {
	selectedMode: "api-key";
	keySource: "CODEX_API_KEY" | "OPENAI_API_KEY" | "none";
} {
	if (env.CODEX_API_KEY)
		return { selectedMode: "api-key", keySource: "CODEX_API_KEY" };
	if (env.OPENAI_API_KEY)
		return { selectedMode: "api-key", keySource: "OPENAI_API_KEY" };
	return { selectedMode: "api-key", keySource: "none" };
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
	return childEnv as NodeJS.ProcessEnv;
}

export function redactSecrets(text: string): string {
	let redacted = text;
	for (const value of [
		env.CODEX_API_KEY,
		env.OPENAI_API_KEY,
		process.env.CODEX_API_KEY,
		process.env.OPENAI_API_KEY,
	]) {
		if (value && value.length > 8) {
			redacted = redacted.split(value).join("[REDACTED_API_KEY]");
		}
	}
	return redacted;
}
