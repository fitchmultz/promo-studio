import { after } from "next/server";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createVariantRun, resolveAgentFromForm } from "@/lib/agent/runner";
import { parseAgentEvents } from "@/lib/agent/transcript";
import { prisma } from "@/lib/db";
import { primaryPromoProduct } from "@/lib/products";
import {
	normalizeRunListLimit,
	variantRunCursorPageArgs,
} from "@/lib/variant-run-pagination";
import {
	serializeVariantRunListItem,
	variantRunListSelect,
} from "@/lib/variant-run-dto";
import { isSameOriginPost, sameOriginResponseBaseUrl } from "@/lib/same-origin";

function expectsFormEncoded(request: Request) {
	const contentType = request.headers.get("content-type") ?? "";
	return (
		contentType.includes("multipart/form-data") ||
		contentType.includes("application/x-www-form-urlencoded")
	);
}

export async function GET(request: Request) {
	const user = await requireUser();
	const searchParams = new URL(request.url).searchParams;
	const requestedCursor = searchParams.get("cursor");
	const limit = normalizeRunListLimit(searchParams.get("limit"));
	const where = user.role === "admin" ? undefined : { userId: user.id };
	const cursorExists = requestedCursor
		? await prisma.variantRun.findFirst({
				where: { id: requestedCursor, ...where },
				select: { id: true },
			})
		: null;
	const cursor = cursorExists ? requestedCursor : null;
	const runsPage = await prisma.variantRun.findMany({
		where,
		select: variantRunListSelect,
		...variantRunCursorPageArgs(cursor, limit),
	});
	const hasMore = runsPage.length > limit;
	const runs = runsPage.slice(0, limit);
	return NextResponse.json({
		runs: runs.map(serializeVariantRunListItem),
		pagination: {
			limit,
			hasMore,
			nextCursor: hasMore ? (runs.at(-1)?.id ?? null) : null,
		},
	});
}

export async function POST(request: Request) {
	if (!isSameOriginPost(request)) {
		return NextResponse.json(
			{ error: "Cross-origin requests are not accepted." },
			{ status: 403 },
		);
	}
	if (!expectsFormEncoded(request)) {
		return NextResponse.json(
			{ error: "Send campaign data as form-encoded." },
			{ status: 400 },
		);
	}
	const user = await requireUser();
	const form = await request.formData();
	const campaignBrief = String(form.get("campaignBrief") ?? "").trim();
	const campaignGoal = String(form.get("campaignGoal") ?? "Launch").trim();
	if (campaignBrief.length < 12) {
		return NextResponse.json(
			{ error: "Describe the campaign in at least 12 characters." },
			{ status: 400 },
		);
	}
	const productId = String(form.get("productId") ?? "ribbed-market-tote");
	const products = await prisma.product.findMany({ orderBy: { name: "asc" } });
	const product =
		products.find((entry) => entry.id === productId) ??
		primaryPromoProduct(products);
	if (!product)
		return NextResponse.json(
			{ error: "No product is seeded." },
			{ status: 500 },
		);
	let agent: ReturnType<typeof resolveAgentFromForm>;
	try {
		agent = resolveAgentFromForm(form);
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Invalid agent runtime settings.",
			},
			{ status: 400 },
		);
	}
	let run: Awaited<ReturnType<typeof createVariantRun>>;
	try {
		run = await createVariantRun({
			user,
			product,
			campaignBrief,
			campaignGoal,
			runtimeSpec: agent,
			scheduler: after,
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to create variant run.";
		const status =
			message.includes("API-key mode requested") ||
			message.includes("CURSOR_API_KEY is required")
				? 400
				: 500;
		return NextResponse.json({ error: message }, { status });
	}
	const acceptsHtml =
		request.headers.get("accept")?.includes("text/html") ?? false;
	if (acceptsHtml) {
		return NextResponse.redirect(
			new URL(`/runs/${run.id}`, sameOriginResponseBaseUrl(request)),
			303,
		);
	}
	return NextResponse.json(
		{
			id: run.id,
			status: run.status,
			events: parseAgentEvents(run.transcript),
		},
		{ status: 202 },
	);
}
