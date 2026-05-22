import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listAvailablePiModels } from "@/lib/pi-models";

export const dynamic = "force-dynamic";

export async function GET() {
	await requireUser();
	const result = await listAvailablePiModels();
	return NextResponse.json(result);
}
