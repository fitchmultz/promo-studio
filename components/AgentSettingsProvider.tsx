"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	type AgentSettings,
	DEFAULT_AGENT_SETTINGS,
	readAgentSettings,
	writeAgentSettings,
} from "@/lib/agent-settings-storage";

interface AgentSettingsContextValue {
	settings: AgentSettings;
	updateSettings: (patch: Partial<AgentSettings>) => void;
	dialogOpen: boolean;
	openDialog: () => void;
	closeDialog: () => void;
}

const AgentSettingsContext = createContext<AgentSettingsContextValue | null>(
	null,
);

export function AgentSettingsProvider({ children }: { children: ReactNode }) {
	const [settings, setSettings] = useState(DEFAULT_AGENT_SETTINGS);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [hydrated, setHydrated] = useState(false);

	useEffect(() => {
		setSettings(readAgentSettings());
		setHydrated(true);
	}, []);

	useEffect(() => {
		if (!hydrated) return;
		writeAgentSettings(settings);
	}, [hydrated, settings]);

	const updateSettings = useCallback((patch: Partial<AgentSettings>) => {
		setSettings((current) => {
			const next = { ...current, ...patch };
			if (patch.agentCore && patch.agentCore !== current.agentCore) {
				next.agentHarness = patch.agentCore === "pi" ? "json" : "sdk";
				next.model =
					patch.agentCore === "pi" ? "cursor/composer-2.5" : "codex-default";
			}
			return next;
		});
	}, []);

	const value = useMemo(
		() => ({
			settings,
			updateSettings,
			dialogOpen,
			openDialog: () => setDialogOpen(true),
			closeDialog: () => setDialogOpen(false),
		}),
		[settings, updateSettings, dialogOpen],
	);

	return (
		<AgentSettingsContext.Provider value={value}>
			{children}
		</AgentSettingsContext.Provider>
	);
}

export function useAgentSettings() {
	const context = useContext(AgentSettingsContext);
	if (!context) {
		throw new Error(
			"useAgentSettings must be used within AgentSettingsProvider",
		);
	}
	return context;
}
