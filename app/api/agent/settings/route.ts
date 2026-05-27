import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
	type AgentSettings,
	parseAgentSettingsPayload,
	parseStoredAgentSettings,
	serializeAgentSettings,
} from "@/lib/agent-settings-runtime";
import { prisma } from "@/lib/db";

export async function GET() {
	const user = await requireUser();
	const record = await prisma.user.findUnique({
		where: { id: user.id },
		select: { agentPreferences: true },
	});
	const settings = parseStoredAgentSettings(record?.agentPreferences);
	return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
	const user = await requireUser();
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
	}
	let settings: AgentSettings;
	try {
		settings = parseAgentSettingsPayload(body);
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Invalid agent settings payload.",
			},
			{ status: 400 },
		);
	}
	await prisma.user.update({
		where: { id: user.id },
		data: { agentPreferences: serializeAgentSettings(settings) },
	});
	return NextResponse.json({ settings });
}
