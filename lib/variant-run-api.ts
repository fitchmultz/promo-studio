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
	run: z.object({
		status: z.string(),
		hasPreview: z.boolean().optional(),
	}),
});

export const DiffLineSchema = z.object({
	kind: z.enum(["added", "removed", "neutral"]),
	text: z.string(),
	key: z.string(),
});

export const DiffEntrySchema = z.object({
	file: z.string(),
	diffLines: z.array(DiffLineSchema),
});

export const RunDiffResponseSchema = z.object({
	status: z.string(),
	changedFiles: z.array(z.string()),
	diffs: z.array(DiffEntrySchema),
});

export const CreateVariantRunResponseSchema = z.object({
	id: z.string().optional(),
	error: z.string().optional(),
});
