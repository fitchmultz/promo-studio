import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	allowedDevOrigins: ["127.0.0.1"],
	devIndicators: false,
	serverExternalPackages: [
		"@earendil-works/pi-coding-agent",
		"@openai/codex-sdk",
		"better-sqlite3",
	],
};

export default nextConfig;
