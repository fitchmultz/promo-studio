import { describe, expect, it } from "vitest";
import {
	shortenCodexFileChangePath,
	shortenStorefrontPath,
} from "@/lib/activity-path";

describe("activity-path helpers", () => {
	it("shortens absolute storefront paths", () => {
		expect(
			shortenStorefrontPath(
				"/repo/agent-workspaces/run-abc/storefront/src/theme.ts",
			),
		).toBe("src/theme.ts");
	});

	it("shortens Codex file_change paths consistently", () => {
		expect(
			shortenCodexFileChangePath(
				"/repo/codex-workspaces/run-abc/storefront/src/theme.ts",
			),
		).toBe("src/theme.ts");
	});
});
