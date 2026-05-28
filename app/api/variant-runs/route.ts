import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createVariantRun, resolveAgentFromForm } from "@/lib/agent/runner";
import { parseAgentEvents } from "@/lib/agent/transcript";
import { prisma } from "@/lib/db";
import { primaryPromoProduct } from "@/lib/products";
import {
	serializeVariantRunListItem,
	variantRunListSelect,
} from "@/lib/variant-run-dto";
import { isSameOriginPost, sameOriginResponseBaseUrl } from "@/lib/same-origin";

export async function GET() {
	const user = await requireUser();
	const runs = await prisma.variantRun.findMany({
		where: user.role === "admin" ? undefined : { userId: user.id },
		select: variantRunListSelect,
		orderBy: { startedAt: "desc" },
		take: 30,
	});
	return NextResponse.json({ runs: runs.map(serializeVariantRunListItem) });
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
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to create variant run.";
		const status = message.includes("API-key mode requested") ? 400 : 500;
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
