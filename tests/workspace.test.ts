import { rm, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { paths } from "@/lib/config";
import { createVariantWorkspace, detectChangedFiles } from "@/lib/workspace";

const createdRunIds: string[] = [];

async function createTestWorkspace(runId: string) {
	createdRunIds.push(runId);
	return createVariantWorkspace(runId);
}

afterEach(async () => {
	await Promise.all(
		createdRunIds.splice(0).map((runId) =>
			rm(path.join(paths.workspaces, `run-${runId}`), {
				recursive: true,
				force: true,
			}),
		),
	);
});

describe("variant workspace isolation", () => {
	it("copies the storefront template into an isolated run directory", async () => {
		const workspace = await createTestWorkspace("test-workspace-copy");
		const productSource = await readFile(
			path.join(workspace, "src", "product.ts"),
			"utf8",
		);
		expect(workspace).toContain("agent-workspaces");
		expect(productSource).toContain("RMT-001");
	});

	it("keeps storefront tooling owned by the repository root package", async () => {
		const [rootPackageJson, templatePackageJson] = await Promise.all([
			readFile(path.join(paths.projectRoot, "package.json"), "utf8"),
			readFile(path.join(paths.templateStorefront, "package.json"), "utf8"),
		]);
		const rootPackage = JSON.parse(rootPackageJson);
		const templatePackage = JSON.parse(templatePackageJson);
		expect(templatePackage.dependencies).toBeUndefined();
		expect(templatePackage.devDependencies).toBeUndefined();
		for (const packageName of ["@vitejs/plugin-react", "vite", "vitest"]) {
			expect(rootPackage.devDependencies[packageName]).toEqual(
				expect.any(String),
			);
		}
		expect(rootPackage.dependencies.react).toEqual(expect.any(String));
		expect(rootPackage.dependencies["react-dom"]).toEqual(expect.any(String));
	});

	it("resolves template build tooling from root dependencies available to isolated workspaces", async () => {
		const workspace = await createTestWorkspace("test-workspace-tooling");
		const workspaceRequire = createRequire(
			path.join(workspace, "package.json"),
		);
		for (const packageName of ["@vitejs/plugin-react", "vite", "vitest"]) {
			const resolvedPath = workspaceRequire.resolve(packageName);
			expect(resolvedPath).toContain("node_modules");
			expect(resolvedPath).not.toContain(`${workspace}${path.sep}`);
		}
	});

	it("detects source changes relative to the template", async () => {
		const workspace = await createTestWorkspace("test-workspace-diff");
		await writeFile(
			path.join(workspace, "src", "theme.ts"),
			"export const theme = { changed: true } as const;\n",
		);
		await writeFile(
			path.join(workspace, "src", "components", "CampaignBanner.tsx"),
			"export function CampaignBanner() { return null; }\n",
		);
		const changed = await detectChangedFiles(workspace);
		expect(changed).toContain("src/theme.ts");
		expect(changed).toContain("src/components/CampaignBanner.tsx");
	});
});
