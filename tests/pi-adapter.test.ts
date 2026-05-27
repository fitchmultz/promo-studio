import { describe, expect, it } from "vitest";
import { piJsonArgs } from "@/lib/agent/pi-adapter";

describe("piJsonArgs", () => {
	it("uses explicit automation sessions without print-mode -p flags", () => {
		const args = piJsonArgs("cursor/composer-2.5", {
			sessionDir: "/tmp/promo-studio-sessions",
			sessionId: "run-123",
		});
		expect(args).toEqual([
			"--mode",
			"json",
			"--session-id",
			"run-123",
			"--session-dir",
			"/tmp/promo-studio-sessions",
			"--model",
			"cursor/composer-2.5",
		]);
		expect(args).not.toContain("-p");
	});

	it("omits --model when empty", () => {
		expect(
			piJsonArgs("", {
				sessionDir: "/tmp/promo-studio-sessions",
				sessionId: "run-123",
			}),
		).toEqual([
			"--mode",
			"json",
			"--session-id",
			"run-123",
			"--session-dir",
			"/tmp/promo-studio-sessions",
		]);
	});
});
