import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	createVariantRun,
	parseCodexEvents,
	type VariantProcessRunner,
} from "@/lib/codex-runner";
import { prisma } from "@/lib/db";

async function waitForRun(id: string) {
	for (let index = 0; index < 40; index += 1) {
		const run = await prisma.variantRun.findUnique({ where: { id } });
		if (run && run.status !== "running") return run;
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
	throw new Error("Run did not finish during the test.");
}

describe("Codex runner", () => {
	it("streams JSONL, validates the manifest, and persists preview evidence", async () => {
		const user = await prisma.user.findUniqueOrThrow({
			where: { email: "demo@promostudio.test" },
		});
		const product = await prisma.product.findUniqueOrThrow({
			where: { id: "ribbed-market-tote" },
		});
		let codexArgs: string[] = [];
		const runner: VariantProcessRunner = async (_command, args, options) => {
			codexArgs = args;
			options.onStdoutLine?.(
				JSON.stringify({
					type: "tool_call",
					item: { type: "file_read", name: "src/ProductPage.tsx" },
				}),
			);
			options.onStdoutLine?.(
				JSON.stringify({
					type: "tool_call",
					item: { type: "file_write", name: "src/theme.ts" },
				}),
			);
			options.onStdoutLine?.(
				JSON.stringify({
					type: "tool_call",
					item: { type: "shell_command", name: "npm test" },
				}),
			);
			await writeFile(
				path.join(options.cwd, "src", "theme.ts"),
				"export const theme = { colors: { action: '#123456' } } as const;\n",
			);
			await mkdir(path.join(options.cwd, "dist", "assets"), {
				recursive: true,
			});
			await writeFile(
				path.join(options.cwd, "dist", "assets", "index.css"),
				"body::after{content:'Variant $42.00 $&'}",
			);
			await writeFile(
				path.join(options.cwd, "dist", "assets", "index.js"),
				"document.body.dataset.preview='</script-safe>';\ndocument.body.dataset.replacement='$&';\n",
			);
			await writeFile(
				path.join(options.cwd, "dist", "index.html"),
				'<link rel="stylesheet" crossorigin href="/assets/index.css"><script type="module" crossorigin src="/assets/index.js"></script><div id="root">Variant $42.00</div>',
			);
			await writeFile(
				path.join(options.cwd, "artifact", "manifest.json"),
				JSON.stringify({
					summary: "Created a tested campaign variant.",
					changedFiles: ["src/theme.ts"],
					commandsRun: ["npm test", "npm run build"],
					testsPassed: true,
					buildPassed: true,
					commerceInvariantsPreserved: true,
					previewPath: "dist/index.html",
				}),
			);
			return {
				code: 0,
				stdout: [
					JSON.stringify({
						type: "tool_call",
						item: { type: "file_read", name: "src/ProductPage.tsx" },
					}),
					JSON.stringify({
						type: "tool_call",
						item: { type: "shell_command", name: "npm run build" },
					}),
				].join("\n"),
				stderr: "",
				timedOut: false,
			};
		};
		const started = await createVariantRun({
			user,
			product,
			campaignBrief:
				"Make the tote compelling for commuters who need a practical gift.",
			campaignGoal: "Holiday gift push",
			requestedAuthMode: "auto",
			requestedModel: "gpt-5.5-mini",
			requestedEffort: "medium",
			runner,
		});
		const completed = await waitForRun(started.id);
		expect(codexArgs).toEqual(
			expect.arrayContaining([
				"-m",
				"gpt-5.5-mini",
				"-c",
				'model_reasoning_effort="medium"',
			]),
		);
		expect(completed.status).toBe("succeeded");
		expect(completed.requestedModel).toBe("gpt-5.5-mini");
		expect(completed.selectedModel).toBe("gpt-5.5-mini");
		expect(completed.requestedEffort).toBe("medium");
		expect(completed.selectedEffort).toBe("medium");
		expect(completed.codexCommand).toContain(completed.workspacePath);
		expect(completed.codexCommand).not.toContain("<isolated-workspace>");
		expect(completed.testsPassed).toBe(true);
		expect(completed.previewHtml).toContain("Variant $42.00 $&");
		expect(completed.previewHtml).toContain("<style>body::after");
		expect(completed.previewHtml).toContain("<\\/script-safe>");
		expect(completed.previewHtml).toContain(
			"document.body.dataset.replacement='$&';",
		);
		expect(completed.previewHtml).not.toContain('src="/assets/index.js"');
		expect(JSON.parse(completed.changedFiles)).toContain("src/theme.ts");
	});

	it("parses non-JSON transcript lines as logs", () => {
		const events = parseCodexEvents('not json\n{"type":"tool_call"}');
		expect(events[0].type).toBe("log");
		expect(events[1].type).toBe("tool_call");
	});

	it("assigns stable unique ids to duplicate transcript lines", () => {
		const events = parseCodexEvents("duplicate\nduplicate");
		expect(events.map((event) => event.id)).toEqual([
			"1:e24a5a32c9b8",
			"2:e24a5a32c9b8",
		]);
	});
});
