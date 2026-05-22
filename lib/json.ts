import { z } from "zod";

export function isJsonObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

const StringArraySchema = z.array(z.string());

export function parseStringArrayJson(raw: string): string[] {
	try {
		const parsed: unknown = JSON.parse(raw || "[]");
		const result = StringArraySchema.safeParse(parsed);
		return result.success ? result.data : [];
	} catch {
		return [];
	}
}
