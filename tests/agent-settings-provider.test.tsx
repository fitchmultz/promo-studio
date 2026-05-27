// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	AgentSettingsProvider,
	useAgentSettings,
} from "@/components/AgentSettingsProvider";

const actGlobal = globalThis as typeof globalThis & {
	IS_REACT_ACT_ENVIRONMENT?: boolean;
};
actGlobal.IS_REACT_ACT_ENVIRONMENT = true;

function SettingsProbe() {
	const { settings, updateSettings } = useAgentSettings();
	return (
		<button
			data-harness={settings.agentHarness}
			data-model={settings.model}
			type="button"
			onClick={() => updateSettings({ model: "gpt-5.5-mini" })}
		>
			{settings.agentCore}
		</button>
	);
}

describe("AgentSettingsProvider", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
		container = document.createElement("div");
		document.body.append(container);
		root = createRoot(container);
	});

	afterEach(() => {
		act(() => root.unmount());
		container.remove();
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("uses server-provided initial settings without writing during hydration", () => {
		act(() => {
			root.render(
				<AgentSettingsProvider
					initialSettings={{
						agentCore: "codex",
						agentHarness: "exec",
						model: "gpt-5.5",
						reasoningEffort: "high",
						authMode: "subscription",
					}}
				>
					<SettingsProbe />
				</AgentSettingsProvider>,
			);
		});

		const button = container.querySelector("button");
		expect(button?.textContent).toBe("codex");
		expect(button?.dataset.harness).toBe("exec");
		expect(fetch).not.toHaveBeenCalled();
	});

	it("persists only explicit edits", () => {
		act(() => {
			root.render(
				<AgentSettingsProvider
					initialSettings={{
						agentCore: "codex",
						agentHarness: "sdk",
						model: "gpt-5.5",
						reasoningEffort: "low",
						authMode: "auto",
					}}
				>
					<SettingsProbe />
				</AgentSettingsProvider>,
			);
		});

		act(() => container.querySelector("button")?.click());
		act(() => vi.advanceTimersByTime(400));

		expect(fetch).toHaveBeenCalledWith(
			"/api/agent/settings",
			expect.objectContaining({
				method: "PUT",
				body: expect.stringContaining("gpt-5.5-mini"),
			}),
		);
	});
});
