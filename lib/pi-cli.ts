import { findPackageJSON } from "node:module";
import path from "node:path";

/**
 * Pi 1.3.0's bin is bundled with undici 8.10.2, which npm overrides cannot fix.
 * Launch the package's shipped unbundled CLI so its patched external undici is
 * used. Resolve with Node's package resolver, not PATH or a global installation.
 * Fail closed if a future package no longer ships this entrypoint.
 */
export function piCliCommand(): string[] {
	const packageJson = findPackageJSON(
		"@earendil-works/pi-coding-agent",
		import.meta.url,
	);
	if (!packageJson)
		throw new Error("The local Pi package could not be resolved.");
	return [
		process.execPath,
		path.join(path.dirname(packageJson), "dist", "cli.js"),
	];
}
