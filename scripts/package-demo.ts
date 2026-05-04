#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";

const DEFAULT_OUTPUT = "tmp/demo/promo-studio-demo.zip";

function help() {
	console.log(`Promo Studio demo packager

Usage: npm run demo:zip [-- output.zip] [--video walkthrough.mp4]

Creates a zip archive from git-tracked project files only. This excludes dependencies, build outputs, local databases, Codex workspaces, private notes, generated review artifacts, and other ignored local files. Optionally appends a local walkthrough video at the zip root. Requires git and the system zip command.

Examples:
  npm run demo:zip
  npm run demo:zip -- tmp/demo/promo-studio-demo.zip
  npm run demo:zip -- tmp/demo/promo-studio-demo.zip --video ~/Movies/promo-studio-walkthrough.mp4

Exit codes:
  0  Archive created or help shown
  1  Archive failed`);
}

function parseArgs(args: string[]) {
	let output = DEFAULT_OUTPUT;
	let outputSet = false;
	let videoPath = "";
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--video") {
			videoPath = args[index + 1] ?? "";
			index += 1;
			continue;
		}
		if (arg.startsWith("--")) {
			throw new Error(`Unknown option: ${arg}`);
		}
		if (outputSet) {
			throw new Error(`Unexpected extra argument: ${arg}`);
		}
		output = arg;
		outputSet = true;
	}
	return { output, videoPath };
}

if (process.argv.includes("-h") || process.argv.includes("--help")) {
	help();
	process.exit(0);
}

let output = DEFAULT_OUTPUT;
let videoPath = "";
try {
	({ output, videoPath } = parseArgs(process.argv.slice(2)));
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
}

mkdirSync(path.dirname(output), { recursive: true });

const trackedFiles = spawnSync("git", ["ls-files"], {
	encoding: "utf8",
});
if (trackedFiles.status !== 0) {
	console.error(trackedFiles.stderr || "Unable to list git-tracked files.");
	process.exit(1);
}

const files = trackedFiles.stdout
	.split("\n")
	.map((file) => file.trim())
	.filter(Boolean);

if (!files.length) {
	console.error("No tracked files found to archive.");
	process.exit(1);
}

let result = spawnSync("zip", ["-r", output, ...files], {
	stdio: "inherit",
});
if (result.status !== 0) process.exit(result.status ?? 1);

if (videoPath) {
	if (!existsSync(videoPath) || !statSync(videoPath).isFile()) {
		console.error(`Video file not found: ${videoPath}`);
		process.exit(1);
	}
	result = spawnSync("zip", ["-j", output, videoPath], {
		stdio: "inherit",
	});
	if (result.status !== 0) process.exit(result.status ?? 1);
}

process.exit(0);
