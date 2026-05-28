#!/usr/bin/env tsx
/**
 * Live E2E: create + execute variant runs for Codex SDK, Codex exec, and Pi JSON.
 * Verifies transcript streaming during execution and a succeeded receipt.
 */
import { createVariantRun, executeVariantRun } from "@/lib/agent/runner";
import { parseAgentEvents } from "@/lib/agent/transcript";
import { agentEventsToActivityRows } from "@/lib/activity-view";
import { prisma } from "@/lib/db";

const BRIEF =
	"Make the Ribbed Market Tote a vivid commuter gift: warmer hero copy, one accent color in theme.ts, and a short gift story block. Run tests and build.";
const GOAL = "Harness E2E smoke";
const POLL_MS = 1500;
const MAX_POLLS = 400;

type HarnessCase = {
	label: string;
	agentCore: "codex" | "pi";
	agentHarness: string;
};

const CASES: HarnessCase[] = [
	{ label: "codex-sdk", agentCore: "codex", agentHarness: "sdk" },
	{ label: "codex-exec", agentCore: "codex", agentHarness: "exec" },
	{ label: "pi-json", agentCore: "pi", agentHarness: "json" },
];

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForStatus(
	runId: string,
	target: Set<string>,
	timeoutMs: number,
) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const run = await prisma.variantRun.findUnique({ where: { id: runId } });
		if (!run) throw new Error(`Run ${runId} disappeared.`);
		if (target.has(run.status)) return run;
		await sleep(POLL_MS);
	}
	throw new Error(
		`Timed out waiting for ${[...target].join("|")} on ${runId}.`,
	);
}

async function monitorStreaming(runId: string, until: Promise<unknown>) {
	let lastLen = 0;
	let growthSamples = 0;
	let maxEvents = 0;
	const poll = (async () => {
		for (let index = 0; index < MAX_POLLS; index += 1) {
			const run = await prisma.variantRun.findUnique({
				where: { id: runId },
				select: { status: true, transcript: true, agentCore: true },
			});
			if (!run) break;
			const len = run.transcript.length;
			if (len > lastLen) {
				if (lastLen > 0) growthSamples += 1;
				lastLen = len;
				const events = parseAgentEvents(run.transcript);
				maxEvents = Math.max(maxEvents, events.length);
			}
			if (run.status === "succeeded" || run.status === "failed") break;
			await sleep(POLL_MS);
		}
	})();

	await until;
	await poll;

	const final = await prisma.variantRun.findUniqueOrThrow({
		where: { id: runId },
	});
	const events = parseAgentEvents(final.transcript);
	const activity = agentEventsToActivityRows({
		agentCore: final.agentCore === "pi" ? "pi" : "codex",
		agentLabel: final.agentCore === "pi" ? "Pi" : "Codex",
		events,
		maxBodyChars: 4000,
		demoLive: true,
	});

	return {
		growthSamples,
		transcriptChars: final.transcript.length,
		eventCount: events.length,
		activityRows: activity.length,
		maxEvents,
	};
}

async function runCase(testCase: HarnessCase) {
	const user = await prisma.user.findUniqueOrThrow({
		where: { email: "demo@promostudio.test" },
	});
	const product = await prisma.product.findUniqueOrThrow({
		where: { id: "ribbed-market-tote" },
	});

	console.log(`\n=== ${testCase.label} ===`);
	const started = await createVariantRun({
		user,
		product,
		campaignBrief: BRIEF,
		campaignGoal: GOAL,
		agentCore: testCase.agentCore,
		agentHarness: testCase.agentHarness,
		requestedAuthMode: "auto",
	});
	console.log(
		`queued ${started.id} core=${started.agentCore} harness=${started.agentHarness}`,
	);

	const stream = monitorStreaming(started.id, executeVariantRun(started.id));
	const completed = await waitForStatus(
		started.id,
		new Set(["succeeded", "failed"]),
		600_000,
	);
	const metrics = await stream;

	const lines = [
		`status=${completed.status}`,
		`transcriptChars=${metrics.transcriptChars}`,
		`events=${metrics.eventCount}`,
		`activityRows=${metrics.activityRows}`,
		`streamGrowthSamples=${metrics.growthSamples}`,
		`testsPassed=${completed.testsPassed}`,
		`buildPassed=${completed.buildPassed}`,
		`preview=${completed.previewHtml ? "yes" : "no"}`,
	];
	console.log(lines.join(" "));

	if (completed.status !== "succeeded") {
		throw new Error(
			`${testCase.label} failed: ${completed.error ?? "unknown error"}`,
		);
	}
	if (metrics.transcriptChars < 50) {
		throw new Error(`${testCase.label}: transcript too short.`);
	}
	if (metrics.eventCount < 1) {
		throw new Error(`${testCase.label}: no parsed transcript events.`);
	}
	if (metrics.activityRows < 1) {
		throw new Error(`${testCase.label}: no activity rows from transcript.`);
	}
	if (metrics.growthSamples < 1) {
		throw new Error(
			`${testCase.label}: transcript did not grow during run (no streaming).`,
		);
	}
	if (!completed.previewHtml) {
		throw new Error(`${testCase.label}: missing preview HTML.`);
	}

	console.log(`PASS ${testCase.label}`);
	return completed;
}

async function main() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error("DATABASE_URL is required (e.g. file:./dev.db).");
	}
	console.log(`agent-harness-e2e using ${databaseUrl}`);

	for (const testCase of CASES) {
		await runCase(testCase);
	}
	console.log("\nAll harnesses passed.");
}

main()
	.catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
