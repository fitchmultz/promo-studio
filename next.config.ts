import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
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
			const extra = ["**/agent-workspaces/**", "**/codex-workspaces/**"];
			const ignored = config.watchOptions?.ignored;
			const base = (
				Array.isArray(ignored) ? ignored : ignored ? [ignored] : []
			).filter(
				(entry): entry is string =>
					typeof entry === "string" && entry.length > 0,
			);
			config.watchOptions = {
				...config.watchOptions,
				ignored: [...base, ...extra],
			};
		}
		return config;
	},
};

export default nextConfig;
