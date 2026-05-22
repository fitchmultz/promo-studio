import { mkdir, open } from "node:fs/promises";
import path from "node:path";

function resolveDatabasePath(target: string) {
	if (path.isAbsolute(target) || target.split(/[\\/]/).includes("..")) {
		throw new Error("Database path must stay inside this project.");
	}
	const databasePath = path.resolve(target);
	const relativePath = path.relative(process.cwd(), databasePath);
	if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
		throw new Error("Database path must stay inside this project.");
	}
	return databasePath;
}

function printHelp() {
	console.log(`Ensure SQLite database file

Usage:
  tsx scripts/ensure-sqlite-database.ts dev.db
  tsx scripts/ensure-sqlite-database.ts test.db

Examples:
  DATABASE_URL=file:./dev.db tsx scripts/ensure-sqlite-database.ts dev.db
  DATABASE_URL=file:./test.db tsx scripts/ensure-sqlite-database.ts test.db

Exit codes:
  0  Database file exists or was created.
  1  Missing path, unsupported option, or file creation failed.
`);
}

async function main() {
	const [target] = process.argv.slice(2);
	if (target === "-h" || target === "--help") {
		printHelp();
		return;
	}
	if (!target || target.startsWith("-")) {
		throw new Error(
			"Provide a SQLite database path, such as dev.db or test.db.",
		);
	}

	const databasePath = resolveDatabasePath(target);
	await mkdir(path.dirname(databasePath), { recursive: true });
	const handle = await open(databasePath, "a");
	await handle.close();
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
