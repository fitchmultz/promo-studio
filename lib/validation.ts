import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const REQUIRED_PREVIEW_PATH = "dist/index.html";

export const ManifestSchema = z.object({
	summary: z.string().min(1),
	changedFiles: z.array(z.string().min(1)).min(1),
	commandsRun: z.array(z.string().min(1)).min(2),
	testsPassed: z.boolean(),
	buildPassed: z.boolean(),
	commerceInvariantsPreserved: z.boolean(),
	previewPath: z.literal(REQUIRED_PREVIEW_PATH),
});

export type VariantManifest = z.infer<typeof ManifestSchema>;

export interface VariantReceiptEvidence {
	detectedChangedFiles: string[];
}

export interface VariantReceiptValidationResult {
	passed: boolean;
	summary: string;
	/** Real source-file changes detected from the workspace/template diff. */
	changedFiles: string[];
}

export async function readVariantManifest(workspacePath: string) {
	const manifestPath = path.join(workspacePath, "artifact", "manifest.json");
	const raw = await readFile(manifestPath, "utf8");
	return ManifestSchema.parse(JSON.parse(raw));
}

export function isSafeWorkspaceFile(file: string) {
	const normalized = file.replaceAll("\\", "/");
	return (
		!normalized.includes(":") &&
		!path.posix.isAbsolute(normalized) &&
		normalized
			.split("/")
			.every((segment) => segment && segment !== "." && segment !== "..")
	);
}

function normalizedWorkspaceFile(file: string) {
	return file.replaceAll("\\", "/");
}

function isSourceWorkspaceFile(file: string) {
	return normalizedWorkspaceFile(file).startsWith("src/");
}

const FORBIDDEN_CHANGED_FILES = new Set([
	"package.json",
	"package-lock.json",
	"src/cart.ts",
	"src/product.ts",
]);

const ALLOWED_NON_SOURCE_DETECTED_FILES = new Set(["artifact/manifest.json"]);

export function validateVariantReceipt(
	manifest: VariantManifest,
	evidence: VariantReceiptEvidence,
): VariantReceiptValidationResult {
	const detectedChangedFiles = evidence.detectedChangedFiles
		.map(normalizedWorkspaceFile)
		.sort();
	const manifestChangedFiles = manifest.changedFiles
		.map(normalizedWorkspaceFile)
		.sort();
	const detectedSet = new Set(detectedChangedFiles);
	const manifestSet = new Set(manifestChangedFiles);
	const detectedSourceChanges = detectedChangedFiles.filter(
		isSourceWorkspaceFile,
	);
	const commandsText = manifest.commandsRun.join("\n").toLowerCase();
	const unsafeDetectedFiles = detectedChangedFiles.filter(
		(file) => !isSafeWorkspaceFile(file),
	);
	const unsafeManifestFiles = manifestChangedFiles.filter(
		(file) => !isSafeWorkspaceFile(file),
	);
	const forbiddenChanges = detectedChangedFiles.filter((file) =>
		FORBIDDEN_CHANGED_FILES.has(file),
	);
	const claimedButNotDetected = manifestChangedFiles.filter(
		(file) => !detectedSet.has(file),
	);
	const forbiddenNonSourceDetectedFiles = detectedChangedFiles.filter(
		(file) =>
			!isSourceWorkspaceFile(file) &&
			!ALLOWED_NON_SOURCE_DETECTED_FILES.has(file),
	);
	const detectedButNotClaimed = detectedChangedFiles.filter(
		(file) =>
			!manifestSet.has(file) && !ALLOWED_NON_SOURCE_DETECTED_FILES.has(file),
	);
	const checks = [
		manifest.testsPassed,
		manifest.buildPassed,
		manifest.commerceInvariantsPreserved,
		commandsText.includes("npm test"),
		commandsText.includes("npm run build"),
		detectedSourceChanges.length > 0,
		unsafeDetectedFiles.length === 0,
		unsafeManifestFiles.length === 0,
		forbiddenChanges.length === 0,
		claimedButNotDetected.length === 0,
		detectedButNotClaimed.length === 0,
		forbiddenNonSourceDetectedFiles.length === 0,
	];
	const passed = checks.every(Boolean);
	return {
		passed,
		changedFiles: detectedSourceChanges,
		summary: [
			`Manifest summary: ${manifest.summary}`,
			`Tests passed: ${manifest.testsPassed ? "yes" : "no"}`,
			`Build passed: ${manifest.buildPassed ? "yes" : "no"}`,
			`Commerce invariants preserved: ${manifest.commerceInvariantsPreserved ? "yes" : "no"}`,
			`Commands: ${manifest.commandsRun.join(" | ")}`,
			`Manifest claimed changes: ${manifestChangedFiles.join(", ")}`,
			`Detected workspace changes: ${detectedChangedFiles.join(", ")}`,
			`Detected source changes: ${detectedSourceChanges.length ? detectedSourceChanges.join(", ") : "none"}`,
			`Unsafe detected paths: ${unsafeDetectedFiles.length ? unsafeDetectedFiles.join(", ") : "none"}`,
			`Unsafe manifest paths: ${unsafeManifestFiles.length ? unsafeManifestFiles.join(", ") : "none"}`,
			`Forbidden changes: ${forbiddenChanges.length ? forbiddenChanges.join(", ") : "none"}`,
			`Claimed but not detected: ${claimedButNotDetected.length ? claimedButNotDetected.join(", ") : "none"}`,
			`Detected changes missing from manifest: ${detectedButNotClaimed.length ? detectedButNotClaimed.join(", ") : "none"}`,
			`Forbidden non-source changes: ${forbiddenNonSourceDetectedFiles.length ? forbiddenNonSourceDetectedFiles.join(", ") : "none"}`,
			`Preview path: ${manifest.previewPath}`,
			`Validation: ${passed ? "passed" : "failed"}`,
		].join("\n"),
	};
}
