import { describe, expect, it } from "vitest";
import { piJsonArgs } from "@/lib/agent/pi-adapter";

describe("piJsonArgs", () => {
	it("does not pass print-mode -p flags", () => {
		expect(piJsonArgs("cursor/composer-2.5")).toEqual([
			"--mode",
			"json",
			"--no-session",
			"--model",
			"cursor/composer-2.5",
		]);
		expect(piJsonArgs("cursor/composer-2.5")).not.toContain("-p");
	});

	it("omits --model when empty", () => {
		expect(piJsonArgs("")).toEqual(["--mode", "json", "--no-session"]);
	});
});
