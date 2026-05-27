import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultCodexSdkRunner } from "@/lib/agent/codex-adapter";
import { paths } from "@/lib/config";

type MockEvent = Record<string, unknown>;

function mockCodexSdk(events: MockEvent[]) {
	const constructedOptions: unknown[] = [];
	const threadOptions: unknown[] = [];
	const runInputs: unknown[] = [];
	const runOptions: unknown[] = [];

	vi.doMock("@openai/codex-sdk", () => ({
		Codex: class {
			constructor(options: unknown) {
				constructedOptions.push(options);
			}

			startThread(options: unknown) {
				threadOptions.push(options);
				return {
					runStreamed: async (input: unknown, options: unknown) => {
						runInputs.push(input);
						runOptions.push(options);
						return {
							events: (async function* () {
								for (const event of events) yield event;
							})(),
						};
					},
				};
			}
		},
	}));

	return { constructedOptions, threadOptions, runInputs, runOptions };
}

describe("defaultCodexSdkRunner", () => {
	afterEach(() => {
		vi.doUnmock("@openai/codex-sdk");
		vi.clearAllMocks();
	});

	it("uses SDK streamed turns with explicit automation controls", async () => {
		const calls = mockCodexSdk([
			{ type: "thread.started", thread_id: "thread_123" },
			{
				type: "item.completed",
				item: { type: "command_execution", command: "npm test" },
			},
			{
				type: "turn.completed",
				usage: {
					input_tokens: 1,
					cached_input_tokens: 0,
					output_tokens: 1,
					reasoning_output_tokens: 0,
				},
			},
		]);
		const stdoutLines: string[] = [];

		const result = await defaultCodexSdkRunner({
			input: "Build a storefront variant.",
			keySource: "none",
			requestedEffort: "low",
			requestedModel: "gpt-5.5",
			timeoutMs: 30_000,
			workspace: "/tmp/promo-studio/storefront",
			onStdoutLine: (line) => stdoutLines.push(line),
		});

		expect(result).toMatchObject({ code: 0, stderr: "", timedOut: false });
		expect(stdoutLines).toHaveLength(3);
		expect(calls.constructedOptions).toHaveLength(1);
		expect(calls.constructedOptions[0]).toMatchObject({
			env: expect.objectContaining({ PROJECT_ROOT: paths.projectRoot }),
		});
		expect(calls.constructedOptions[0]).not.toHaveProperty("codexPathOverride");
		expect(calls.threadOptions[0]).toMatchObject({
			approvalPolicy: "never",
			model: "gpt-5.5",
			modelReasoningEffort: "low",
			networkAccessEnabled: false,
			sandboxMode: "workspace-write",
			skipGitRepoCheck: true,
			webSearchMode: "disabled",
			workingDirectory: "/tmp/promo-studio/storefront",
		});
		expect(calls.runInputs).toEqual(["Build a storefront variant."]);
		const [turnOptions] = calls.runOptions as Array<{ signal?: AbortSignal }>;
		expect(turnOptions.signal).toBeInstanceOf(AbortSignal);
	});

	it("reports streamed Codex failure events as failed process results", async () => {
		mockCodexSdk([
			{ type: "thread.started", thread_id: "thread_123" },
			{ type: "turn.failed", error: { message: "authentication failed" } },
		]);
		const stderrLines: string[] = [];

		const result = await defaultCodexSdkRunner({
			input: "Build a storefront variant.",
			keySource: "none",
			requestedEffort: "",
			requestedModel: "",
			timeoutMs: 30_000,
			workspace: "/tmp/promo-studio/storefront",
			onStderrLine: (line) => stderrLines.push(line),
		});

		expect(result).toMatchObject({
			code: 1,
			stderr: "authentication failed",
			timedOut: false,
		});
		expect(stderrLines).toEqual(["authentication failed"]);
	});
});
