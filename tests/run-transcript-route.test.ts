import { MAX_POLL_TRANSCRIPT_CHARS } from "@/lib/agent/process";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserMock = vi.fn();
const findUniqueMock = vi.fn();
const resolveFullTranscriptMock = vi.fn();

vi.mock("@/lib/auth", () => ({ requireUser: requireUserMock }));
vi.mock("@/lib/db", () => ({
	prisma: {
		variantRun: { findUnique: findUniqueMock },
	},
}));
vi.mock("@/lib/agent/transcript-store", async () => {
	const actual = await vi.importActual<
		typeof import("@/lib/agent/transcript-store")
	>("@/lib/agent/transcript-store");
	return {
		resolveFullTranscript: resolveFullTranscriptMock,
		transcriptBodyForPoll: actual.transcriptBodyForPoll,
	};
});

function run(overrides: Record<string, unknown> = {}) {
	return {
		id: "run-1",
		userId: "user-1",
		transcript: "db tail",
		agentCore: "codex",
		codexCommand: "codex exec",
		...overrides,
	};
}

describe("variant run transcript API", () => {
	beforeEach(() => {
		requireUserMock
			.mockReset()
			.mockResolvedValue({ id: "user-1", role: "admin" });
		findUniqueMock.mockReset().mockResolvedValue(run());
		resolveFullTranscriptMock
			.mockReset()
			.mockResolvedValue('{"type":"start"}\n{"type":"end"}\n');
	});

	it("returns full transcript text as an attachment when download=1", async () => {
		const { GET } = await import(
			"@/app/api/variant-runs/[id]/transcript/route"
		);
		const response = await GET(
			new Request(
				"http://localhost:3000/api/variant-runs/run-1/transcript?download=1",
			),
			{ params: Promise.resolve({ id: "run-1" }) },
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-disposition")).toBe(
			'attachment; filename="variant-run-run-1-transcript.jsonl"',
		);
		expect(response.headers.get("content-type")).toContain("text/plain");
		await expect(response.text()).resolves.toBe(
			'{"type":"start"}\n{"type":"end"}\n',
		);
		expect(resolveFullTranscriptMock).toHaveBeenCalledWith("run-1", "db tail");
	});

	it("keeps returning JSON tail metadata by default", async () => {
		const { GET } = await import(
			"@/app/api/variant-runs/[id]/transcript/route"
		);
		const response = await GET(
			new Request(
				"http://localhost:3000/api/variant-runs/run-1/transcript?tail=1",
			),
			{ params: Promise.resolve({ id: "run-1" }) },
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			text: '{"type":"end"}',
			totalLines: 2,
			shownLines: 1,
			truncated: true,
			agentCore: "codex",
			invocation: "codex exec",
		});
	});

	it("caps oversized non-download transcript payloads while download keeps full fidelity", async () => {
		const lines = Array.from(
			{ length: 2500 },
			(_, index) =>
				`{"type":"message_update","payload":"${"x".repeat(1000)}","n":${index}}`,
		);
		const full = `${lines.join("\n")}\n`;
		resolveFullTranscriptMock.mockResolvedValueOnce(full).mockResolvedValueOnce(full);

		const { GET } = await import(
			"@/app/api/variant-runs/[id]/transcript/route"
		);
		const pollResponse = await GET(
			new Request(
				"http://localhost:3000/api/variant-runs/run-1/transcript?tail=2000",
			),
			{ params: Promise.resolve({ id: "run-1" }) },
		);

		expect(pollResponse.status).toBe(200);
		const pollBody = await pollResponse.json();
		expect(pollBody.text.length).toBeLessThanOrEqual(
			MAX_POLL_TRANSCRIPT_CHARS,
		);
		expect(pollBody.text).toContain('"n":2499');
		expect(pollBody.text).not.toContain('"n":500');
		expect(pollBody.totalLines).toBe(2500);
		expect(pollBody.shownLines).toBeGreaterThan(0);
		expect(pollBody.shownLines).toBeLessThan(2000);
		expect(pollBody.truncated).toBe(true);

		const downloadResponse = await GET(
			new Request(
				"http://localhost:3000/api/variant-runs/run-1/transcript?download=1",
			),
			{ params: Promise.resolve({ id: "run-1" }) },
		);
		expect(downloadResponse.status).toBe(200);
		await expect(downloadResponse.text()).resolves.toBe(full);
	});
});
