import { describe, expect, it } from "vitest";
import { listAvailablePiModels } from "@/lib/pi-models";

describe("listAvailablePiModels", () => {
	it("returns pi-default and provider/model entries", async () => {
		const result = await listAvailablePiModels();
		expect(result.models.length).toBeGreaterThan(0);
		expect(result.models[0]?.value).toBe("pi-default");
		const withProvider = result.models.find((m) => m.provider === "anthropic");
		if (withProvider) {
			expect(withProvider.value).toMatch(/^anthropic\/.+/);
		}
	});
});
