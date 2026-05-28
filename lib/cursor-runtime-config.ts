import { z } from "zod";

export const CURSOR_DEFAULT_MODEL = "cursor-default";
/** UI / receipt label for Composer 2.5 with the fast parameter enabled. */
export const CURSOR_FAST_MODEL_ID = "composer-2.5-fast";
/** Base model id passed to `@cursor/sdk` (`Cursor.models.list()`). */
export const CURSOR_BASE_MODEL_ID = "composer-2.5";

const CursorModelIdSchema = z
	.string()
	.trim()
	.max(80)
	.regex(
		/^[a-zA-Z0-9._-]+$/,
		"Cursor model ids may contain only letters, numbers, dots, underscores, and hyphens.",
	);

export interface CursorModelSelection {
	id: string;
	params?: Array<{ id: string; value: string }>;
}

function cursorFastParam(enabled: boolean) {
	return [{ id: "fast", value: enabled ? "true" : "false" }] as const;
}

export function normalizeCursorModel(
	raw: FormDataEntryValue | string | null | undefined,
): string {
	const value = String(raw ?? "").trim();
	if (!value || value === CURSOR_DEFAULT_MODEL) return "";
	return CursorModelIdSchema.parse(value);
}

/** Stored / displayed model name (fast tier uses the `composer-2.5-fast` sentinel). */
export function selectedCursorModel(requestedModel: string): string {
	const normalized = normalizeCursorModel(requestedModel);
	if (!normalized) return CURSOR_FAST_MODEL_ID;
	return normalized;
}

/**
 * Map Promo Studio model settings to a Cursor SDK `ModelSelection`.
 * `composer-2.5-fast` is not a real model id — it enables `fast: true` on `composer-2.5`.
 */
export function parseCursorModelSelection(
	requestedModel: string,
): CursorModelSelection {
	const normalized = normalizeCursorModel(
		requestedModel === CURSOR_DEFAULT_MODEL ? "" : requestedModel,
	);
	if (!normalized || normalized === CURSOR_FAST_MODEL_ID) {
		return {
			id: CURSOR_BASE_MODEL_ID,
			params: [...cursorFastParam(true)],
		};
	}
	if (normalized === CURSOR_BASE_MODEL_ID) {
		return {
			id: CURSOR_BASE_MODEL_ID,
			params: [...cursorFastParam(false)],
		};
	}
	return { id: normalized };
}

export function cursorModelDescriptorValue(
	selection: CursorModelSelection,
): string {
	const fast = selection.params?.find((param) => param.id === "fast")?.value;
	if (selection.id === CURSOR_BASE_MODEL_ID && fast === "true") {
		return CURSOR_FAST_MODEL_ID;
	}
	if (selection.id === CURSOR_BASE_MODEL_ID && fast === "false") {
		return CURSOR_BASE_MODEL_ID;
	}
	return selection.id;
}
