"use client";

import { useAgentSettings } from "@/components/AgentSettingsProvider";
import { studioAgentIntroSentence } from "@/lib/agent-display";

export function StudioHeroIntro({ userName }: { userName: string }) {
	const { settings } = useAgentSettings();
	return <p>{studioAgentIntroSentence(settings.agentCore, userName)}</p>;
}
