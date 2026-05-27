import { drainQueuedVariantRunQueue } from "@/lib/codex-runner";

const HELP = `Usage: npm run runs:worker -- [--once] [--poll-ms <ms>]

Claims queued storefront variant runs, executes them through the stored agent runtime, and finalizes receipts.

Options:
  --once          Process the current queue once, then exit.
  --poll-ms <ms>  Poll interval when the queue is empty. Default: 1000.
  -h, --help      Show this help.

Exit codes:
  0  Worker stopped normally.
  1  Invalid arguments or worker failure.
`;

function parseArgs(argv: string[]) {
	let once = false;
	let pollMs = 1000;
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "-h" || arg === "--help") {
			console.log(HELP);
			process.exit(0);
		}
		if (arg === "--once") {
			once = true;
			continue;
		}
		if (arg === "--poll-ms") {
			const value = Number(argv[index + 1]);
			if (!Number.isFinite(value) || value < 100) {
				throw new Error("--poll-ms must be a number >= 100.");
			}
			pollMs = Math.floor(value);
			index += 1;
			continue;
		}
		throw new Error(`Unknown argument: ${arg}`);
	}
	return { once, pollMs };
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

try {
	const { once, pollMs } = parseArgs(process.argv.slice(2));
	let shouldRun = true;
	while (shouldRun) {
		const processed = await drainQueuedVariantRunQueue();
		if (processed > 0 || once) {
			console.log(
				`Processed ${processed} queued variant run${processed === 1 ? "" : "s"}.`,
			);
		}
		shouldRun = !once;
		if (shouldRun) await sleep(processed > 0 ? 0 : pollMs);
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
}
