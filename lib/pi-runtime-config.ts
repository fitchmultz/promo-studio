import path from "node:path";
import { PI_DEFAULT_MODEL } from "@/lib/agent-defaults";
import { toProcessEnv } from "@/lib/process-env";
import { z } from "zod";

export type PiThinkingLevel =
	| "off"
	| "minimal"
	| "low"
	| "medium"
	| "high"
	| "xhigh";

export { PI_DEFAULT_MODEL } from "@/lib/agent-defaults";
export const PI_PROVIDER_ENV_KEYS = [
	"ANTHROPIC_API_KEY",
	"ANTHROPIC_OAUTH_TOKEN",
	"ANT_LING_API_KEY",
	"OPENAI_API_KEY",
	"AZURE_OPENAI_API_KEY",
	"AZURE_OPENAI_BASE_URL",
	"AZURE_OPENAI_RESOURCE_NAME",
	"AZURE_OPENAI_API_VERSION",
	"AZURE_OPENAI_DEPLOYMENT_NAME_MAP",
	"DEEPSEEK_API_KEY",
	"NVIDIA_API_KEY",
	"GEMINI_API_KEY",
	"GROQ_API_KEY",
	"CEREBRAS_API_KEY",
	"XAI_API_KEY",
	"FIREWORKS_API_KEY",
	"TOGETHER_API_KEY",
	"OPENROUTER_API_KEY",
	"AI_GATEWAY_API_KEY",
	"ZAI_API_KEY",
	"ZAI_CODING_CN_API_KEY",
	"MISTRAL_API_KEY",
	"MINIMAX_API_KEY",
	"MOONSHOT_API_KEY",
	"OPENCODE_API_KEY",
	"KIMI_API_KEY",
	"CLOUDFLARE_API_KEY",
	"CLOUDFLARE_ACCOUNT_ID",
	"CLOUDFLARE_GATEWAY_ID",
	"XIAOMI_API_KEY",
	"XIAOMI_TOKEN_PLAN_CN_API_KEY",
	"XIAOMI_TOKEN_PLAN_AMS_API_KEY",
	"XIAOMI_TOKEN_PLAN_SGP_API_KEY",
	"AWS_PROFILE",
	"AWS_ACCESS_KEY_ID",
	"AWS_SECRET_ACCESS_KEY",
	"AWS_BEARER_TOKEN_BEDROCK",
	"AWS_REGION",
] as const;
export const PI_RUNTIME_ENV_KEYS = [
	"PI_CODING_AGENT_DIR",
	"PI_CODING_AGENT_SESSION_DIR",
	"PI_PACKAGE_DIR",
	"PI_OFFLINE",
	"PI_TELEMETRY",
	"PI_SHARE_VIEWER_URL",
] as const;
export const PI_CHILD_ENV_KEYS = [
	...PI_PROVIDER_ENV_KEYS,
	...PI_RUNTIME_ENV_KEYS,
] as const;
export const PI_SECRET_ENV_KEYS = PI_PROVIDER_ENV_KEYS.filter((key) =>
	/(API_KEY|OAUTH_TOKEN|ACCESS_KEY_ID|SECRET_ACCESS_KEY|SESSION_TOKEN|BEARER_TOKEN)/.test(
		key,
	),
);

const PiThinkingLevelSchema = z.enum([
	"off",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
]);
const PiModelOverrideSchema = z
	.string()
	.trim()
	.max(80)
	.regex(
		/^[a-zA-Z0-9._:/-]+$/,
		"Model names may contain only letters, numbers, dots, underscores, colons, slashes, and hyphens.",
	);

export function piProjectRoot(
	env: NodeJS.ProcessEnv = process.env,
	cwd = process.cwd(),
) {
	return env.PROJECT_ROOT ?? cwd;
}

export function piSessionsPath(projectRoot = piProjectRoot()) {
	return path.join(projectRoot, "artifacts", "pi-sessions");
}

export function normalizePiModel(
	raw: FormDataEntryValue | string | null | undefined,
): string {
	const value = String(raw ?? "").trim();
	if (!value || value === PI_DEFAULT_MODEL) return "";
	return PiModelOverrideSchema.parse(value);
}

export interface PiModelSpec {
	/** Empty when the user supplied a Pi CLI model pattern instead of provider/model. */
	provider: string;
	modelId: string;
	thinking: PiThinkingLevel | "";
	/** Full Pi CLI model ref, e.g. openai-codex/gpt-5.5:low */
	cliModel: string;
}

function parsePiThinkingSuffix(value: string): {
	modelId: string;
	thinking: PiThinkingLevel | "";
} {
	const colon = value.lastIndexOf(":");
	if (colon === -1) return { modelId: value, thinking: "" };
	const suffix = value.slice(colon + 1);
	const parsed = PiThinkingLevelSchema.safeParse(suffix);
	if (!parsed.success) return { modelId: value, thinking: "" };
	return { modelId: value.slice(0, colon), thinking: parsed.data };
}

/** Parse PI_MODEL as a Pi CLI model pattern or provider/model with optional :thinking. */
export function parsePiModelSpec(requestedModel: string): PiModelSpec {
	const value = String(requestedModel ?? "").trim();
	if (!value) {
		return { provider: "", modelId: "", thinking: "", cliModel: "" };
	}
	const slash = value.indexOf("/");
	if (slash === -1) {
		const { modelId, thinking } = parsePiThinkingSuffix(value);
		if (!modelId) {
			throw new Error(
				`PI_MODEL must include a model pattern (got "${value}").`,
			);
		}
		return { provider: "", modelId, thinking, cliModel: value };
	}
	const provider = value.slice(0, slash);
	const rest = value.slice(slash + 1);
	const { modelId, thinking } = parsePiThinkingSuffix(rest);
	if (!provider || !modelId) {
		throw new Error(
			`PI_MODEL must be a Pi model pattern or provider/model with optional :thinking (got "${value}").`,
		);
	}
	const cliModel = thinking
		? `${provider}/${modelId}:${thinking}`
		: `${provider}/${modelId}`;
	return { provider, modelId, thinking, cliModel };
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

export function piThinkingLevel(
	thinking: PiThinkingLevel | "",
): PiThinkingLevel {
	if (!thinking) return "low";
	const parsed = PiThinkingLevelSchema.safeParse(thinking);
	return parsed.success ? parsed.data : "low";
}

export function piChildEnv(
	sourceEnv: NodeJS.ProcessEnv = process.env,
	projectRoot = piProjectRoot(sourceEnv),
) {
	const childEnv: Record<string, string | undefined> = {
		PATH: sourceEnv.PATH,
		USER: sourceEnv.USER,
		LOGNAME: sourceEnv.LOGNAME,
		SHELL: sourceEnv.SHELL,
		LANG: sourceEnv.LANG,
		LC_ALL: sourceEnv.LC_ALL,
		TERM: sourceEnv.TERM,
		TMPDIR: sourceEnv.TMPDIR,
		PROJECT_ROOT: projectRoot,
		HOME: sourceEnv.HOME,
	};
	for (const key of PI_CHILD_ENV_KEYS) {
		childEnv[key] = sourceEnv[key];
	}
	return toProcessEnv(childEnv);
}
