#!/usr/bin/env tsx
import {
	cursorApiKeyConfigured,
	env,
	resolveCursorApiKey,
} from "../lib/config";

function help() {
	console.log(`Promo Studio Cursor SDK doctor

Usage: npm run cursor:doctor

Checks CURSOR_API_KEY and optionally validates it against the Cursor API.

Exit codes:
  0  API key present (and me() succeeded when checked)
  1  Missing key or API check failed`);
}

if (process.argv.includes("-h") || process.argv.includes("--help")) {
	help();
	process.exit(0);
}

if (!cursorApiKeyConfigured()) {
	console.error(
		"Missing CURSOR_API_KEY. Set it in .env for Cursor SDK variant runs.",
	);
	process.exit(1);
}

console.log("OK CURSOR_API_KEY is configured.");
console.log(`Default model env CURSOR_MODEL=${env.CURSOR_MODEL}`);

async function checkApi() {
	try {
		const { Cursor } = await import("@cursor/sdk");
		const apiKey = resolveCursorApiKey();
		const user = await Cursor.me({ apiKey });
		console.log(`OK Cursor.me apiKeyName=${user.apiKeyName}`);
		const models = await Cursor.models.list({ apiKey });
		const composer = models.find((model) => model.id === "composer-2.5");
		const fastParam = composer?.parameters?.find((param) => param.id === "fast");
		const fastEnabled = fastParam?.values.some((entry) => entry.value === "true");
		if (composer && fastEnabled) {
			console.log(
				"OK composer-2.5 with fast=true is available (Promo Studio default).",
			);
		} else if (composer) {
			console.warn(
				"Warning: composer-2.5 is listed but the fast parameter is unavailable; default runs use standard Composer 2.5.",
			);
		} else {
			console.warn(
				"Warning: composer-2.5 not listed; Cursor SDK runs may fail for this key.",
			);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`Cursor API check failed: ${message}`);
		process.exit(1);
	}
}

await checkApi();
