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
	const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		let active = true;
		async function hydrate() {
			const local = readAgentSettings();
			try {
				const response = await fetch("/api/agent/settings", {
					cache: "no-store",
				});
				if (active && response.ok) {
					const payload: unknown = await response.json();
					if (
						typeof payload === "object" &&
						payload !== null &&
						"settings" in payload &&
						typeof payload.settings === "object" &&
						payload.settings !== null
					) {
						setSettings({
							...DEFAULT_AGENT_SETTINGS,
							...(payload.settings as AgentSettings),
						});
						writeAgentSettings(payload.settings as AgentSettings);
						setHydrated(true);
						return;
					}
				}
			} catch {
				// Offline or logged-out edge case — localStorage still applies.
			}
			if (active) {
				setSettings(local);
				setHydrated(true);
			}
		}
		void hydrate();
		return () => {
			active = false;
		};
	}, []);

	useEffect(() => {
		if (!hydrated) return;
		writeAgentSettings(settings);
		if (persistTimer.current) clearTimeout(persistTimer.current);
		persistTimer.current = setTimeout(() => {
			void fetch("/api/agent/settings", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(settings),
			});
		}, 400);
		return () => {
			if (persistTimer.current) clearTimeout(persistTimer.current);
		};
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
