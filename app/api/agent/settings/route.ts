import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
	type AgentSettings,
	DEFAULT_AGENT_SETTINGS,
	parseStoredAgentSettings,
	serializeAgentSettings,
} from "@/lib/agent-settings-storage";
import { prisma } from "@/lib/db";

const PutAgentSettingsSchema = z.object({
	agentCore: z.enum(["codex", "pi"]),
	agentHarness: z.string(),
	model: z.string(),
	reasoningEffort: z.string(),
	authMode: z.string(),
});

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
	const parsed = PutAgentSettingsSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid agent settings payload." },
			{ status: 400 },
		);
	}
	const settings: AgentSettings = {
		...parsed.data,
		agentHarness:
			parsed.data.agentCore === "pi" ? "json" : parsed.data.agentHarness,
	};
	await prisma.user.update({
		where: { id: user.id },
		data: { agentPreferences: serializeAgentSettings(settings) },
	});
	return NextResponse.json({ settings });
}
