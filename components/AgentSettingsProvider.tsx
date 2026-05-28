"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	type AgentSettings,
	DEFAULT_AGENT_SETTINGS,
	normalizeAgentSettings,
} from "@/lib/agent-settings-shared";

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

export function AgentSettingsProvider({
	children,
	initialSettings = DEFAULT_AGENT_SETTINGS,
}: {
	children: ReactNode;
	initialSettings?: AgentSettings;
}) {
	const [settings, setSettings] = useState(() =>
		normalizeAgentSettings(initialSettings),
	);
	const [dialogOpen, setDialogOpen] = useState(false);
	const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		setSettings(normalizeAgentSettings(initialSettings));
	}, [initialSettings]);

	useEffect(
		() => () => {
			if (persistTimer.current) clearTimeout(persistTimer.current);
		},
		[],
	);

	const persistExplicitUpdate = useCallback((next: AgentSettings) => {
		if (persistTimer.current) clearTimeout(persistTimer.current);
		persistTimer.current = setTimeout(() => {
			void fetch("/api/agent/settings", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(next),
			});
		}, 400);
	}, []);

	const updateSettings = useCallback(
		(patch: Partial<AgentSettings>) => {
			setSettings((current) => {
				const next = normalizeAgentSettings({ ...current, ...patch });
				if (patch.agentCore && patch.agentCore !== current.agentCore) {
					if (patch.agentCore === "pi") {
						next.agentHarness = "json";
						next.model = "cursor/composer-2.5";
					} else if (patch.agentCore === "cursor") {
						next.agentHarness = "sdk";
						next.model = "composer-2.5-fast";
					} else {
						next.agentHarness = "sdk";
						next.model = "codex-default";
					}
				}
				persistExplicitUpdate(next);
				return next;
			});
		},
		[persistExplicitUpdate],
	);

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
