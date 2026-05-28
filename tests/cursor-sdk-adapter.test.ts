import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultCursorSdkRunner } from "@/lib/agent/cursor-adapter";

type MockSdkMessage = Record<string, unknown>;

function mockCursorSdk(
	messages: MockSdkMessage[],
	waitStatus: "finished" | "error" = "finished",
) {
	const createOptions: unknown[] = [];
	const sendInputs: unknown[] = [];

	vi.doMock("@/lib/cursor-model-resolve", () => ({
		resolveCursorModelSelection: async (
			_key: string,
			requested: string,
		) => {
			const { parseCursorModelSelection } = await import(
				"@/lib/cursor-runtime-config"
			);
			return parseCursorModelSelection(requested || "composer-2.5-fast");
		},
	}));
	vi.doMock("@cursor/sdk", () => ({
		CursorAgentError: class CursorAgentError extends Error {},
		Agent: class {
			static async create(options: unknown) {
				createOptions.push(options);
				return new MockAgent(messages, waitStatus, sendInputs);
			}
		},
	}));

	return { createOptions, sendInputs };
}

class MockAgent {
	readonly agentId = "a1";

	constructor(
		private readonly messages: MockSdkMessage[],
		private readonly waitStatus: "finished" | "error",
		private readonly sendInputs: unknown[],
	) {}

	async send(input: unknown) {
		this.sendInputs.push(input);
		return new MockRun(this.messages, this.waitStatus);
	}

	async [Symbol.asyncDispose]() {}
}

class MockRun {
	readonly id = "r1";
	readonly agentId = "a1";

	constructor(
		private readonly messages: MockSdkMessage[],
		private readonly waitStatus: "finished" | "error",
	) {}

	supports(operation: string) {
		return operation === "cancel";
	}

	async *stream() {
		for (const message of this.messages) yield message;
	}

	async wait() {
		return {
			id: "run_1",
			status: this.waitStatus,
			result: this.waitStatus === "error" ? "authentication failed" : "done",
		};
	}

	async cancel() {}
}

describe("defaultCursorSdkRunner", () => {
	afterEach(() => {
		vi.doUnmock("@cursor/sdk");
		vi.doUnmock("@/lib/cursor-model-resolve");
		vi.clearAllMocks();
	});

	it("streams SDK messages with local automation options", async () => {
		const calls = mockCursorSdk([
			{
				type: "system",
				subtype: "init",
				agent_id: "a1",
				run_id: "r1",
			},
			{
				type: "tool_call",
				agent_id: "a1",
				run_id: "r1",
				call_id: "c1",
				name: "read",
				status: "completed",
				args: { path: "src/theme.ts" },
			},
		]);
		const stdoutLines: string[] = [];

		const result = await defaultCursorSdkRunner({
			input: "Build a storefront variant.",
			requestedModel: "composer-2.5-fast",
			timeoutMs: 30_000,
			workspace: "/tmp/promo-studio/storefront",
			onStdoutLine: (line) => stdoutLines.push(line),
		});

		expect(result).toMatchObject({ code: 0, stderr: "", timedOut: false });
		expect(stdoutLines).toHaveLength(2);
		expect(JSON.parse(stdoutLines[0] ?? "{}")).toMatchObject({
			type: "system",
			subtype: "init",
		});
		expect(JSON.parse(stdoutLines[1] ?? "{}")).toMatchObject({
			type: "tool_call",
			name: "read",
		});
		expect(calls.createOptions[0]).toMatchObject({
			model: {
				id: "composer-2.5",
				params: [{ id: "fast", value: "true" }],
			},
			local: {
				cwd: "/tmp/promo-studio/storefront",
				sandboxOptions: { enabled: true },
			},
		});
		expect(calls.sendInputs).toEqual(["Build a storefront variant."]);
	});

	it("fails fast when CURSOR_API_KEY is missing", async () => {
		const config = await import("@/lib/config");
		const spy = vi.spyOn(config, "resolveCursorApiKey").mockReturnValue("");

		const result = await defaultCursorSdkRunner({
			input: "Build a storefront variant.",
			requestedModel: "composer-2.5-fast",
			timeoutMs: 30_000,
			workspace: "/tmp/promo-studio/storefront",
		});

		spy.mockRestore();
		expect(result).toMatchObject({
			code: 1,
			stderr: expect.stringContaining("CURSOR_API_KEY"),
			timedOut: false,
		});
	});

	it("reports failed run.wait status as a failed process result", async () => {
		mockCursorSdk(
			[{ type: "status", agent_id: "a1", run_id: "r1", status: "ERROR" }],
			"error",
		);
		const stderrLines: string[] = [];

		const result = await defaultCursorSdkRunner({
			input: "Build a storefront variant.",
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
