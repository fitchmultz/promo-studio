import {
	CURSOR_BASE_MODEL_ID,
	type CursorModelSelection,
	cursorModelDescriptorValue,
	parseCursorModelSelection,
} from "@/lib/cursor-runtime-config";

export class CursorModelUnavailableError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "CursorModelUnavailableError";
	}
}

/** Resolve and validate a Cursor SDK model selection for this API key. */
export async function resolveCursorModelSelection(
	apiKey: string,
	requestedModel: string,
): Promise<CursorModelSelection> {
	const selection = parseCursorModelSelection(requestedModel);
	let models: Awaited<
		ReturnType<(typeof import("@cursor/sdk"))["Cursor"]["models"]["list"]>
	>;
	try {
		const { Cursor } = await import("@cursor/sdk");
		models = await Cursor.models.list({ apiKey });
	} catch {
		return selection;
	}
	if (models.length === 0) {
		throw new CursorModelUnavailableError(
			"Cursor.models.list returned no models for this API key.",
		);
	}
	const base = models.find((model) => model.id === selection.id);
	if (!base) {
		const available = models.map((model) => model.id).join(", ");
		throw new CursorModelUnavailableError(
			`Cursor model "${cursorModelDescriptorValue(selection)}" is not available for this API key. Available: ${available}`,
		);
	}
	const wantsFast = selection.params?.some(
		(param) => param.id === "fast" && param.value === "true",
	);
	if (!wantsFast) return selection;
	const fastParam = base.parameters?.find((param) => param.id === "fast");
	if (!fastParam) {
		return { id: selection.id };
	}
	const fastEnabled = fastParam.values.some((entry) => entry.value === "true");
	if (!fastEnabled) {
		return { id: selection.id };
	}
	return selection;
}

export { CURSOR_BASE_MODEL_ID };
