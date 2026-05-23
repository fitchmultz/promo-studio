import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	createVariantRun,
	parseCodexEvents,
	type VariantProcessRunner,
	type VariantSdkRunner,
} from "@/lib/codex-runner";
import { prisma } from "@/lib/db";

async function waitForRun(id: string) {
	for (let index = 0; index < 40; index += 1) {
		const run = await prisma.variantRun.findUnique({ where: { id } });
		if (run && run.status !== "running") return run;
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
	throw new Error("Run did not finish during the test.");
}

async function writeVariantArtifacts(workspace: string) {
	await writeFile(
		path.join(workspace, "src", "theme.ts"),
		"export const theme = { colors: { action: '#123456' } } as const;\n",
	);
	await mkdir(path.join(workspace, "dist", "assets"), {
		recursive: true,
	});
	await writeFile(
		path.join(workspace, "dist", "assets", "index.css"),
		"body::after{content:'Variant $42.00 $&'}",
	);
	await writeFile(
		path.join(workspace, "dist", "assets", "index.js"),
		"document.body.dataset.preview='</script-safe>';\ndocument.body.dataset.replacement='$&';\n",
	);
	await writeFile(
		path.join(workspace, "dist", "index.html"),
		'<link rel="stylesheet" crossorigin href="/assets/index.css"><script type="module" crossorigin src="/assets/index.js"></script><div id="root">Variant $42.00</div>',
	);
	await writeFile(
		path.join(workspace, "artifact", "manifest.json"),
		JSON.stringify({
			summary: "Created a tested campaign variant.",
			changedFiles: ["src/theme.ts"],
			commandsRun: ["npm test", "npm run build"],
			testsPassed: true,
			buildPassed: true,
			commerceInvariantsPreserved: true,
			previewPath: "dist/index.html",
		}),
	);
}

function expectValidatedVariant(
	completed: Awaited<ReturnType<typeof waitForRun>>,
	expected?: {
		model?: string;
		effort?: string;
		invocationIncludesWorkspace?: boolean;
	},
) {
	expect(completed.status).toBe("succeeded");
	const model = expected?.model ?? "gpt-5.5-mini";
	const effort = expected?.effort ?? "medium";
	expect(completed.requestedModel).toBe(model);
	expect(completed.selectedModel).toBe(model);
	expect(completed.requestedEffort).toBe(effort);
	expect(completed.selectedEffort).toBe(effort);
	if (expected?.invocationIncludesWorkspace !== false) {
		expect(completed.codexCommand).toContain(completed.workspacePath);
	}
	expect(completed.codexCommand).not.toContain("<isolated-workspace>");
	expect(completed.testsPassed).toBe(true);
	expect(completed.previewHtml).toContain("Variant $42.00 $&");
	expect(completed.previewHtml).toContain("<style>body::after");
	expect(completed.previewHtml).toContain("<\\/script-safe>");
	expect(completed.previewHtml).toContain(
		"document.body.dataset.replacement='$&';",
	);
	expect(completed.previewHtml).not.toContain('src="/assets/index.js"');
	expect(JSON.parse(completed.changedFiles)).toContain("src/theme.ts");
}

describe("Codex runner", () => {
	it("uses the SDK runtime by default and persists validated preview evidence", async () => {
		const user = await prisma.user.findUniqueOrThrow({
			where: { email: "demo@promostudio.test" },
		});
		const product = await prisma.product.findUniqueOrThrow({
			where: { id: "ribbed-market-tote" },
		});
		const sdkCalls: Array<{
			requestedEffort: string;
			requestedModel: string;
			workspace: string;
		}> = [];
		const sdkRunner: VariantSdkRunner = async (options) => {
			sdkCalls.push({
				requestedEffort: options.requestedEffort,
				requestedModel: options.requestedModel,
				workspace: options.workspace,
			});
			const events = [
				{ type: "thread.started", thread_id: "thread_123" },
				{
					type: "item.completed",
					item: { type: "command_execution", command: "npm test" },
				},
				{ type: "turn.completed", usage: null },
			];
			for (const event of events) options.onStdoutLine?.(JSON.stringify(event));
			await writeVariantArtifacts(options.workspace);
			return {
				code: 0,
				stdout: events.map((event) => JSON.stringify(event)).join("\n"),
				stderr: "",
				timedOut: false,
			};
		};

		const started = await createVariantRun({
			user,
			product,
			campaignBrief:
				"Make the tote compelling for commuters who need a practical gift.",
			campaignGoal: "Holiday gift push",
			requestedAuthMode: "auto",
			requestedModel: "gpt-5.5-mini",
			requestedEffort: "medium",
			sdkRunner,
		});
		const completed = await waitForRun(started.id);

		expect(sdkCalls).toEqual([
			{
				requestedEffort: "medium",
				requestedModel: "gpt-5.5-mini",
				workspace: completed.workspacePath,
			},
		]);
		expect(completed.codexRuntime).toBe("sdk");
		expect(completed.codexCommand).toContain(
			"Codex TypeScript SDK runStreamed",
		);
		expect(completed.transcript).toContain("thread.started");
		expectValidatedVariant(completed, {
			model: "gpt-5.5-mini",
			effort: "medium",
		});
	});

	it("keeps the codex exec fallback runtime available", async () => {
		const user = await prisma.user.findUniqueOrThrow({
			where: { email: "demo@promostudio.test" },
		});
		const product = await prisma.product.findUniqueOrThrow({
			where: { id: "ribbed-market-tote" },
		});
		let codexArgs: string[] = [];
		const runner: VariantProcessRunner = async (_command, args, options) => {
			codexArgs = args;
			const events = [
				{
					type: "tool_call",
					item: { type: "file_read", name: "src/ProductPage.tsx" },
				},
				{
					type: "tool_call",
					item: { type: "file_write", name: "src/theme.ts" },
				},
				{
					type: "tool_call",
					item: { type: "shell_command", name: "npm test" },
				},
				{
					type: "tool_call",
					item: { type: "shell_command", name: "npm run build" },
				},
			];
			for (const event of events) options.onStdoutLine?.(JSON.stringify(event));
			await writeVariantArtifacts(options.cwd);
			return {
				code: 0,
				stdout: events.map((event) => JSON.stringify(event)).join("\n"),
				stderr: "",
				timedOut: false,
			};
		};
		const started = await createVariantRun({
			user,
			product,
			campaignBrief:
				"Make the tote compelling for commuters who need a practical gift.",
			campaignGoal: "Holiday gift push",
			requestedAuthMode: "auto",
			requestedModel: "gpt-5.5-mini",
			requestedEffort: "medium",
			runtime: "exec",
			runner,
		});
		const completed = await waitForRun(started.id);

		expect(codexArgs).toEqual(
			expect.arrayContaining([
				"-m",
				"gpt-5.5-mini",
				"-c",
				'model_reasoning_effort="medium"',
			]),
		);
		expect(completed.codexRuntime).toBe("exec");
		expect(completed.codexCommand).toContain("codex exec --json");
		expectValidatedVariant(completed, {
			model: "gpt-5.5-mini",
			effort: "medium",
		});
	});

	it("redacts SDK runtime failures before persisting errors", async () => {
		const user = await prisma.user.findUniqueOrThrow({
			where: { email: "demo@promostudio.test" },
		});
		const product = await prisma.product.findUniqueOrThrow({
			where: { id: "ribbed-market-tote" },
		});
		const previousKey = process.env.CODEX_API_KEY;
		process.env.CODEX_API_KEY = "sk-test-sdk-failure-secret";
		const sdkRunner: VariantSdkRunner = async () => ({
			code: 1,
			stdout: "",
			stderr: "SDK failed with sk-test-sdk-failure-secret",
			timedOut: false,
		});
		try {
			const started = await createVariantRun({
				user,
				product,
				campaignBrief: "Make the tote a practical commuter gift.",
				campaignGoal: "Holiday gift push",
				requestedAuthMode: "auto",
				requestedModel: "gpt-5.5-mini",
				requestedEffort: "medium",
				sdkRunner,
			});
			const completed = await waitForRun(started.id);

			expect(completed.status).toBe("failed");
			expect(completed.error).toContain("Codex exited with code 1.");
			expect(completed.stderr).toContain("[REDACTED_API_KEY]");
			expect(completed.stderr).not.toContain("sk-test-sdk-failure-secret");
		} finally {
			process.env.CODEX_API_KEY = previousKey;
		}
	});

	it("parses non-JSON transcript lines as logs", () => {
		const events = parseCodexEvents('not json\n{"type":"tool_call"}');
		expect(events[0].type).toBe("log");
		expect(events[1].type).toBe("tool_call");
	});

	it("assigns stable unique ids to duplicate transcript lines", () => {
		const events = parseCodexEvents("duplicate\nduplicate");
		expect(events.map((event) => event.id)).toEqual([
			"1:e24a5a32c9b8",
			"2:e24a5a32c9b8",
		]);
	});

	it("runs Pi JSON harness with mocked pi subprocess", async () => {
		const user = await prisma.user.findUniqueOrThrow({
			where: { email: "demo@promostudio.test" },
		});
		const product = await prisma.product.findUniqueOrThrow({
			where: { id: "ribbed-market-tote" },
		});
		let piArgs: string[] = [];
		const runner: VariantProcessRunner = async (_command, args, options) => {
			piArgs = args;
			const events = [
				{ type: "agent_start" },
				{ type: "agent_end", messages: [] },
			];
			for (const event of events) options.onStdoutLine?.(JSON.stringify(event));
			await writeVariantArtifacts(options.cwd);
			return {
				code: 0,
				stdout: events.map((event) => JSON.stringify(event)).join("\n"),
				stderr: "",
				timedOut: false,
			};
		};
		const started = await createVariantRun({
			user,
			product,
			campaignBrief:
				"Make the tote compelling for commuters who need a practical gift.",
			campaignGoal: "Holiday gift push",
			agentCore: "pi",
			agentHarness: "json",
			requestedModel: "cursor/composer-2.5",
			runner,
		});
		const completed = await waitForRun(started.id);

		expect(piArgs).toEqual([
			"--mode",
			"json",
			"--no-session",
			"--model",
			"cursor/composer-2.5",
		]);
		expect(completed.agentCore).toBe("pi");
		expect(completed.agentHarness).toBe("json");
		expect(completed.codexCommand).toContain("pi --mode json");
		expect(completed.codexCommand).not.toContain("-p");
		expect(completed.transcript).toContain("agent_start");
		expectValidatedVariant(completed, {
			model: "cursor/composer-2.5",
			effort: "default",
			invocationIncludesWorkspace: false,
		});
	});
});
