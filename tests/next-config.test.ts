import { describe, expect, it } from "vitest";
import nextConfig, {
	generatedArtifactDirs,
	outputFileTracingExcludes,
	webpackWatchIgnores,
} from "../next.config";

describe("next config generated artifact exclusions", () => {
	it("derives tracing and watcher globs from artifact directory names", () => {
		expect(generatedArtifactDirs).toEqual(["agent-workspaces", "artifacts"]);
		expect(outputFileTracingExcludes).toEqual([
			"./agent-workspaces/**/*",
			"./artifacts/**/*",
		]);
		expect(webpackWatchIgnores).toEqual([
			"**/agent-workspaces/**",
			"**/artifacts/**",
		]);
		expect(nextConfig.outputFileTracingExcludes).toEqual({
			"/*": outputFileTracingExcludes,
		});
	});

	it("adds explicit generated-artifact ignores to dev webpack watchers", () => {
		const webpack = nextConfig.webpack;
		expect(webpack).toBeDefined();
		if (!webpack) throw new Error("Expected webpack config hook");

		const config = { watchOptions: { ignored: ["**/.next/**"] } };
		const result = webpack(config, {
			dev: true,
		} as Parameters<typeof webpack>[1]);

		expect(result.watchOptions.ignored).toEqual([
			"**/.next/**",
			...webpackWatchIgnores,
		]);
	});
});
