import {
	parsePiModelSpec,
	piChildEnv,
	piThinkingLevel,
	redactSecrets,
} from "@/lib/config";
import { appendLimited, runProcess } from "@/lib/agent/process";
import type {
	RuntimeOptions,
	VariantProcessRunner,
	VariantSdkRunner,
} from "@/lib/agent/types";

function piJsonArgs(requestedModel: string) {
	const args = ["--mode", "json", "--no-session"];
	if (requestedModel) {
		args.push("--model", parsePiModelSpec(requestedModel).cliModel);
	}
	args.push("-p", "-");
	return args;
}

async function resolvePiModel(requestedModel: string) {
	const pi = await import("@earendil-works/pi-coding-agent");
	const authStorage = pi.AuthStorage.create();
	const modelRegistry = pi.ModelRegistry.create(authStorage);
	if (requestedModel) {
		const { provider, modelId } = parsePiModelSpec(requestedModel);
		const model = modelRegistry.find(provider, modelId);
		if (model) return { model, authStorage, modelRegistry, pi };
	}
	const available = await modelRegistry.getAvailable();
	if (available.length === 0) {
		throw new Error(
			"No Pi models are available. Configure provider API keys or set PI_MODEL.",
		);
	}
	return {
		model: available[0],
		authStorage,
		modelRegistry,
		pi,
	};
}

export const defaultPiSdkRunner: VariantSdkRunner = async (options) => {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
	let stdout = "";
	let streamFailure = "";
	let session:
		| Awaited<
				ReturnType<
					Awaited<
						typeof import("@earendil-works/pi-coding-agent")
					>["createAgentSession"]
				>
		  >["session"]
		| undefined;
	try {
		const spec = options.requestedModel
			? parsePiModelSpec(options.requestedModel)
			: parsePiModelSpec("");
		const thinking = piThinkingLevel(spec.thinking);
		const { model, authStorage, modelRegistry, pi } = await resolvePiModel(
			options.requestedModel,
		);
		const created = await pi.createAgentSession({
			cwd: options.workspace,
			model,
			thinkingLevel: thinking,
			authStorage,
			modelRegistry,
			sessionManager: pi.SessionManager.inMemory(options.workspace),
		});
		session = created.session;
		session.subscribe((event) => {
			const line = redactSecrets(JSON.stringify(event));
			stdout = appendLimited(stdout, `${line}\n`);
			options.onStdoutLine?.(line);
		});
		await session.prompt(options.input);
		return { code: 0, stdout, stderr: "", timedOut: false };
	} catch (error) {
		const message = redactSecrets(
			error instanceof Error ? error.message : String(error),
		);
		if (controller.signal.aborted) {
			return { code: null, stdout, stderr: message, timedOut: true };
		}
		streamFailure = message;
		options.onStderrLine?.(message);
		return { code: 1, stdout, stderr: streamFailure, timedOut: false };
	} finally {
		clearTimeout(timeout);
		session?.dispose();
	}
};

export async function runPiJsonRuntime(
	options: RuntimeOptions,
	processRunner: VariantProcessRunner,
) {
	return processRunner("pi", piJsonArgs(options.requestedModel), {
		cwd: options.workspace,
		env: piChildEnv(),
		input: options.input,
		timeoutMs: options.timeoutMs,
		onStdoutLine: options.onStdoutLine,
		onStderrLine: options.onStderrLine,
	});
}

export async function runPiRuntime(params: {
	harness: "sdk" | "json";
	input: string;
	processRunner: VariantProcessRunner;
	sdkRunner: VariantSdkRunner;
	requestedModel: string;
	workspace: string;
	timeoutMs: number;
	onStdoutLine?: (line: string) => void;
	onStderrLine?: (line: string) => void;
}) {
	const runtimeOptions: RuntimeOptions = {
		input: params.input,
		keySource: "none",
		requestedModel: params.requestedModel,
		requestedEffort: "",
		workspace: params.workspace,
		timeoutMs: params.timeoutMs,
		onStdoutLine: params.onStdoutLine,
		onStderrLine: params.onStderrLine,
	};
	const result =
		params.harness === "json"
			? await runPiJsonRuntime(runtimeOptions, params.processRunner)
			: await params.sdkRunner(runtimeOptions);
	return { result, selection: { selectedMode: "subscription" as const } };
}

export { runProcess as runPiProcess };
