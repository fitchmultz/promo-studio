import type { Prisma } from "@prisma/client";

export const DEFAULT_RUN_LIST_LIMIT = 30;
export const MAX_RUN_LIST_LIMIT = 50;

export const variantRunListOrderBy = [
	{ startedAt: "desc" },
	{ id: "desc" },
] satisfies Prisma.VariantRunOrderByWithRelationInput[];

export function normalizeRunListLimit(value: string | null) {
	const parsed = value ? Number.parseInt(value, 10) : DEFAULT_RUN_LIST_LIMIT;
	if (!Number.isFinite(parsed)) return DEFAULT_RUN_LIST_LIMIT;
	return Math.min(MAX_RUN_LIST_LIMIT, Math.max(1, parsed));
}

export function variantRunCursorPageArgs(cursor: string | null, limit: number) {
	return {
		orderBy: variantRunListOrderBy,
		take: limit + 1,
		...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
	} satisfies Pick<
		Prisma.VariantRunFindManyArgs,
		"cursor" | "orderBy" | "skip" | "take"
	>;
}
