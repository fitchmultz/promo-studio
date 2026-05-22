import { z } from "zod";

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
