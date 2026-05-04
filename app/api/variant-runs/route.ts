import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createVariantRun, parseCodexEvents } from "@/lib/codex-runner";
import {
	resolveRequestedMode,
	resolveRequestedModel,
	resolveRequestedReasoningEffort,
} from "@/lib/config";
import { prisma } from "@/lib/db";
import { primaryPromoProduct } from "@/lib/products";
import { isSameOriginPost, sameOriginResponseBaseUrl } from "@/lib/same-origin";

export async function GET() {
	const user = await requireUser();
	const runs = await prisma.variantRun.findMany({
		where: user.role === "admin" ? undefined : { userId: user.id },
		include: { product: true, user: true },
		orderBy: { startedAt: "desc" },
		take: 30,
	});
	return NextResponse.json({ runs });
}

export async function POST(request: Request) {
	if (!isSameOriginPost(request)) {
		return NextResponse.json(
			{ error: "Cross-origin requests are not accepted." },
			{ status: 403 },
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
	const run = await createVariantRun({
		user,
		product,
		campaignBrief,
		campaignGoal,
		requestedAuthMode: resolveRequestedMode(form),
		requestedModel: resolveRequestedModel(form),
		requestedEffort: resolveRequestedReasoningEffort(form),
	});
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
			events: parseCodexEvents(run.transcript),
		},
		{ status: 202 },
	);
}
