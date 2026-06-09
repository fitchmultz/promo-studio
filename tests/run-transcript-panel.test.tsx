// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RunTranscriptPanel } from "@/components/RunTranscriptPanel";

vi.mock("@/components/TranscriptViewer", () => ({
	TranscriptViewer: () => <div>RAW_TRANSCRIPT</div>,
}));

const actGlobal = globalThis as typeof globalThis & {
	IS_REACT_ACT_ENVIRONMENT?: boolean;
};
actGlobal.IS_REACT_ACT_ENVIRONMENT = true;

describe("RunTranscriptPanel", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.append(container);
		root = createRoot(container);
	});

	afterEach(() => {
		act(() => root.unmount());
		container.remove();
	});

	it("shows raw transcript data by default for completed runs", () => {
		act(() => {
			root.render(
				<RunTranscriptPanel
					runId="run-1"
					agentCore="pi"
					selectedModel="openai/gpt-5"
					invocation="pi --mode json"
					initialEvents={[]}
					initialStatus="succeeded"
				/>,
			);
		});

		expect(container.textContent).toContain("Raw JSONL from the agent harness");
		expect(container.textContent).toContain("RAW_TRANSCRIPT");
		expect(container.querySelector("details.transcript-advanced")).toBeNull();
	});

	it("offers transcript download next to the raw JSONL", () => {
		act(() => {
			root.render(
				<RunTranscriptPanel
					runId="run-1"
					agentCore="codex"
					invocation="codex exec"
					initialEvents={[]}
					initialStatus="succeeded"
				/>,
			);
		});

		const download = container.querySelector(
			'a[href="/api/variant-runs/run-1/transcript?download=1"]',
		);
		expect(download?.textContent).toContain("Download full transcript");

		expect(container.textContent).toContain("RAW_TRANSCRIPT");
	});
});
