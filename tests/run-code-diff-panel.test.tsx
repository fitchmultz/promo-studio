// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RunCodeDiffPanel } from "@/components/RunCodeDiffPanel";

const refreshMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
	useRouter: () => ({ refresh: refreshMock }),
}));

const actGlobal = globalThis as typeof globalThis & {
	IS_REACT_ACT_ENVIRONMENT?: boolean;
};
actGlobal.IS_REACT_ACT_ENVIRONMENT = true;

function diffPollResponse(
	overrides: Partial<{
		status: string;
		changedFiles: string[];
		diffs: unknown[];
	}> = {},
) {
	return {
		ok: true,
		json: async () => ({
			status: "running",
			changedFiles: [],
			diffs: [],
			...overrides,
		}),
	} as Response;
}

describe("RunCodeDiffPanel", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.append(container);
		root = createRoot(container);
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(diffPollResponse()));
		vi.spyOn(globalThis, "setInterval").mockReturnValue(
			0 as unknown as ReturnType<typeof setInterval>,
		);
	});

	afterEach(() => {
		act(() => root.unmount());
		container.remove();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("shows a watching message while running with no changed files yet", () => {
		act(() => {
			root.render(
				<RunCodeDiffPanel
					runId="run-1"
					initialStatus="running"
					initialChangedFiles={[]}
				/>,
			);
		});

		expect(container.textContent).toContain("Watching the workspace");
	});

	it("lists changed files while the run is still in progress", () => {
		act(() => {
			root.render(
				<RunCodeDiffPanel
					runId="run-1"
					initialStatus="running"
					initialChangedFiles={["src/App.tsx"]}
				/>,
			);
		});

		expect(container.textContent).toContain("src/App.tsx");
	});

	it("renders completed diff output after the run finishes", () => {
		act(() => {
			root.render(
				<RunCodeDiffPanel
					runId="run-1"
					initialStatus="succeeded"
					initialChangedFiles={["src/App.tsx"]}
					completedDiff={<div>COMPLETED_DIFF</div>}
				/>,
			);
		});

		expect(container.textContent).toContain("COMPLETED_DIFF");
	});

	it("polls the diff endpoint while running", () => {
		act(() => {
			root.render(
				<RunCodeDiffPanel
					runId="run-1"
					initialStatus="running"
					initialChangedFiles={[]}
				/>,
			);
		});

		expect(fetch).toHaveBeenCalledWith(
			"/api/variant-runs/run-1/diff",
			expect.objectContaining({ cache: "no-store" }),
		);
	});
});
