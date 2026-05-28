import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { inlineBuiltPreview } from "@/lib/storefront-preview";
import { paths } from "@/lib/config";
import { rm } from "node:fs/promises";

const runId = "preview-test-run";

afterEach(async () => {
	await rm(path.join(paths.workspaces, `run-${runId}`), {
		recursive: true,
		force: true,
	});
});

describe("inlineBuiltPreview", () => {
	it("inlines Vite dist assets into preview HTML", async () => {
		const workspace = path.join(paths.workspaces, `run-${runId}`, "storefront");
		await mkdir(path.join(workspace, "dist", "assets"), { recursive: true });
		await writeFile(
			path.join(workspace, "dist", "index.html"),
			'<link rel="stylesheet" crossorigin href="/assets/index.css"><script type="module" crossorigin src="/assets/index.js"></script><div id="root"></div>',
		);
		await writeFile(
			path.join(workspace, "dist", "assets", "index.css"),
			"body{color:red}",
		);
		await writeFile(
			path.join(workspace, "dist", "assets", "index.js"),
			"console.log('ok');",
		);

		const html = await inlineBuiltPreview(workspace, "dist/index.html");
		expect(html).toContain("<style>body{color:red}</style>");
		expect(html).toContain(
			"<script type=\"module\">console.log('ok');</script>",
		);
	});

	it("throws a validation-style error when preview assets are missing", async () => {
		const workspace = path.join(paths.workspaces, `run-${runId}`, "storefront");
		await mkdir(path.join(workspace, "dist"), { recursive: true });
		await writeFile(
			path.join(workspace, "dist", "index.html"),
			'<link rel="stylesheet" crossorigin href="/assets/missing.css">',
		);

		await expect(
			inlineBuiltPreview(workspace, "dist/index.html"),
		).rejects.toThrow(/Built preview is missing or malformed/);
	});
});
