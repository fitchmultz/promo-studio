#!/usr/bin/env tsx
/**
 * HTTP E2E against a running app:
 * login → create variant (per harness) → poll live API until terminal.
 *
 * Prereq:
 *   npm run dev
 */
import { cursorApiKeyConfigured } from "../lib/config";

const BASE = process.env.PROMO_STUDIO_BASE_URL ?? "http://localhost:3000";
const BRIEF =
	"Make the Ribbed Market Tote a vivid commuter gift: warmer hero copy, one accent color in theme.ts, and a short gift story block.";
const GOAL = "HTTP harness E2E";

const CASES = [
	{ label: "codex-sdk", agentCore: "codex", agentHarness: "sdk" },
	{ label: "codex-exec", agentCore: "codex", agentHarness: "exec" },
	{ label: "pi-json", agentCore: "pi", agentHarness: "json" },
	{ label: "cursor-sdk", agentCore: "cursor", agentHarness: "sdk" },
] as const;

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loginCookie() {
	const body = new URLSearchParams({
		email: "demo@promostudio.test",
		password: "promo-studio",
		next: "/studio",
	});
	const response = await fetch(`${BASE}/api/login`, {
		method: "POST",
		headers: {
			origin: BASE,
			"content-type": "application/x-www-form-urlencoded",
		},
		body,
		redirect: "manual",
	});
	const cookie = response.headers.getSetCookie?.() ?? [];
	const session = cookie.find((c) => c.startsWith("promo_studio_session="));
	if (!session) throw new Error("Login failed: no session cookie.");
	return session.split(";")[0];
}

async function createRun(cookie: string, testCase: (typeof CASES)[number]) {
	const form = new URLSearchParams({
		campaignBrief: BRIEF,
		campaignGoal: GOAL,
		productId: "ribbed-market-tote",
		agentCore: testCase.agentCore,
		agentHarness: testCase.agentHarness,
		authMode: "auto",
		model:
			testCase.agentCore === "cursor"
				? "composer-2.5-fast"
				: testCase.agentCore === "pi"
					? "cursor/composer-2.5"
					: "",
		reasoningEffort: "",
	});
	const response = await fetch(`${BASE}/api/variant-runs`, {
		method: "POST",
		headers: {
			origin: BASE,
			cookie,
			"content-type": "application/x-www-form-urlencoded",
		},
		body: form,
	});
	const payload = (await response.json()) as { id?: string; error?: string };
	if (!response.ok || !payload.id) {
		throw new Error(
			`${testCase.label} create failed: ${payload.error ?? response.status}`,
		);
	}
	return payload.id;
}

async function pollLive(cookie: string, runId: string) {
	let lastEvents = 0;
	let growth = 0;
	for (let index = 0; index < 400; index += 1) {
		const response = await fetch(`${BASE}/api/variant-runs/${runId}`, {
			headers: { cookie },
		});
		const payload = (await response.json()) as {
			run: { status: string };
			events: unknown[];
		};
		const count = payload.events?.length ?? 0;
		if (count > lastEvents) {
			if (lastEvents > 0) growth += 1;
			lastEvents = count;
		}
		if (payload.run.status === "succeeded") {
			if (growth < 1)
				throw new Error(`${runId}: live API showed no event growth.`);
			return { status: payload.run.status, events: count, growth };
		}
		if (payload.run.status === "failed") {
			throw new Error(`${runId}: run failed.`);
		}
		await sleep(1500);
	}
	throw new Error(`${runId}: timed out waiting for completion.`);
}

async function main() {
	const cookie = await loginCookie();
	console.log(`HTTP E2E against ${BASE}`);
	for (const testCase of CASES) {
		if (testCase.agentCore === "cursor" && !cursorApiKeyConfigured()) {
			console.log(`\n=== ${testCase.label} ===`);
			console.log("SKIP cursor-sdk (CURSOR_API_KEY not configured)");
			continue;
		}
		console.log(`\n=== ${testCase.label} ===`);
		const id = await createRun(cookie, testCase);
		console.log(`created ${id}`);
		const result = await pollLive(cookie, id);
		console.log(
			`PASS ${testCase.label} events=${result.events} liveGrowth=${result.growth}`,
		);
	}
	console.log("\nAll HTTP harnesses passed.");
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
