import { z } from "zod";

export const EventItemSchema = z.object({
	id: z.string(),
	type: z.string(),
	raw: z.string(),
	parsed: z.record(z.string(), z.unknown()),
});

export type EventItemPayload = z.infer<typeof EventItemSchema>;

export const VariantRunPollSchema = z.object({
	events: z.array(EventItemSchema),
	run: z.object({ status: z.string() }),
});

export const CreateVariantRunResponseSchema = z.object({
	id: z.string().optional(),
	error: z.string().optional(),
});
