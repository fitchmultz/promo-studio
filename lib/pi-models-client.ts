import { z } from "zod";

const PiModelsResponseSchema = z.object({
	models: z.array(
		z.object({
			value: z.string(),
			label: z.string(),
			provider: z.string(),
		}),
	),
	error: z.string().optional(),
});

let cachedValues: string[] | null = null;
let inflight: Promise<string[]> | null = null;

/** Shared client fetch for Pi model suggestions (dedupes parallel opens in dev). */
export function fetchPiModelSuggestions(): Promise<string[]> {
	if (cachedValues) return Promise.resolve(cachedValues);
	if (inflight) return inflight;
	inflight = (async () => {
		const response = await fetch("/api/agent/pi-models", { cache: "no-store" });
		if (!response.ok) throw new Error("Could not load model list.");
		const parsed = PiModelsResponseSchema.safeParse(await response.json());
		if (!parsed.success) throw new Error("Could not load model list.");
		cachedValues = parsed.data.models.map((m) => m.value);
		return cachedValues;
	})().finally(() => {
		inflight = null;
	});
	return inflight;
}
