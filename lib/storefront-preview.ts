import { readFile } from "node:fs/promises";
import path from "node:path";
import { isSafeWorkspaceFile } from "@/lib/validation";

function distAssetPath(workspacePath: string, assetPath: string) {
	const relativePath = assetPath.replace(/^\/+/, "");
	if (!isSafeWorkspaceFile(relativePath)) {
		throw new Error(
			`Built preview referenced an unsafe asset path: ${assetPath}`,
		);
	}
	return path.join(workspacePath, "dist", relativePath);
}

async function readPreviewAsset(workspacePath: string, href: string) {
	try {
		return await readFile(distAssetPath(workspacePath, href), "utf8");
	} catch (error) {
		const message =
			error instanceof Error && "code" in error && error.code === "ENOENT"
				? `missing asset ${href}`
				: error instanceof Error
					? error.message
					: String(error);
		throw new Error(`Built preview is missing or malformed: ${message}`);
	}
}

/** Inline Vite dist CSS/JS into preview HTML for iframe rendering. */
export async function inlineBuiltPreview(
	workspacePath: string,
	previewPath: string,
) {
	let html: string;
	try {
		html = await readFile(path.join(workspacePath, previewPath), "utf8");
	} catch (error) {
		const message =
			error instanceof Error && "code" in error && error.code === "ENOENT"
				? `missing ${previewPath}`
				: error instanceof Error
					? error.message
					: String(error);
		throw new Error(`Built preview is missing or malformed: ${message}`);
	}
	const stylesheetMatches = [
		...html.matchAll(/<link rel="stylesheet" crossorigin href="([^"]+)">/g),
	];
	for (const match of stylesheetMatches) {
		const href = match[1];
		const css = await readPreviewAsset(workspacePath, href);
		html = html.replace(
			match[0],
			() => `<style>${css.replace(/<\/style/gi, "<\\/style")}</style>`,
		);
	}
	const scriptMatches = [
		...html.matchAll(
			/<script type="module" crossorigin src="([^"]+)"><\/script>/g,
		),
	];
	for (const match of scriptMatches) {
		const src = match[1];
		const js = await readPreviewAsset(workspacePath, src);
		html = html.replace(
			match[0],
			() =>
				`<script type="module">${js.replace(/<\/script/gi, "<\\/script")}</script>`,
		);
	}
	return html;
}
