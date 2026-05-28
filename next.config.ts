import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
// Agent run outputs can contain thousands of generated files. Keep them out of
// production file tracing and local dev watchers so Next only analyzes source.
export const generatedArtifactDirs = ["agent-workspaces", "artifacts"] as const;

export const outputFileTracingExcludes = generatedArtifactDirs.map(
	(dir) => `./${dir}/**/*`,
);

export const webpackWatchIgnores = generatedArtifactDirs.map(
	(dir) => `**/${dir}/**`,
);

const nextConfig: NextConfig = {
	outputFileTracingExcludes: {
		"/*": outputFileTracingExcludes,
	},
	turbopack: {
		root: projectRoot,
	},
	allowedDevOrigins: ["127.0.0.1"],
	devIndicators: false,
	serverExternalPackages: [
		"@earendil-works/pi-coding-agent",
		"@openai/codex-sdk",
		"better-sqlite3",
	],
	webpack: (config, { dev }) => {
		if (dev) {
			const ignored = config.watchOptions?.ignored;
			const base = (
				Array.isArray(ignored) ? ignored : ignored ? [ignored] : []
			).filter(
				(entry): entry is string =>
					typeof entry === "string" && entry.length > 0,
			);
			config.watchOptions = {
				...config.watchOptions,
				ignored: [...base, ...webpackWatchIgnores],
			};
		}
		return config;
	},
};

export default nextConfig;
