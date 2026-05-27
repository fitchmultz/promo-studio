// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityStream } from "@/components/ActivityStream";
import { RunLiveProvider } from "@/components/RunLiveProvider";

const refreshMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
	useRouter: () => ({ refresh: refreshMock }),
}));

const actGlobal = globalThis as typeof globalThis & {
	IS_REACT_ACT_ENVIRONMENT?: boolean;
};
actGlobal.IS_REACT_ACT_ENVIRONMENT = true;

function event(id: string, text: string) {
	return {
		id,
		type: "agent_message",
		raw: text,
		parsed: { item: { type: "agent_message", text } },
	};
}

describe("ActivityStream", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		refreshMock.mockReset();
		container = document.createElement("div");
		document.body.append(container);
		root = createRoot(container);
		Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
			configurable: true,
			get: () => 500,
		});
	});

	afterEach(() => {
		act(() => root.unmount());
		container.remove();
		vi.unstubAllGlobals();
	});

	it("keeps the activity list scrolled to the latest event", () => {
		act(() => {
			root.render(
				React.createElement(ActivityStream, {
					runId: "run-1",
					initialStatus: "succeeded",
					initialEvents: [event("1", "first"), event("2", "latest")],
				}),
			);
		});

		const list = container.querySelector("ol");
		expect(list?.scrollTop).toBe(500);
		expect(container.querySelector(".activity-card")?.className).toContain(
			"activity-card--succeeded",
		);
	});

	it("refreshes the server-rendered run detail when live polling observes completion", async () => {
		const fetchMock = vi.fn(async () => ({
			ok: true,
			json: async () => ({
				events: [event("1", "completed")],
				run: { status: "succeeded" },
			}),
		}));
		vi.stubGlobal("fetch", fetchMock);

		await act(async () => {
			root.render(
				React.createElement(
					RunLiveProvider,
					{
						runId: "run-1",
						initialStatus: "running",
						initialEvents: [],
						initialHasPreview: false,
					},
					React.createElement(ActivityStream, {
						runId: "run-1",
						initialStatus: "running",
						initialEvents: [],
					}),
				),
			);
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

		expect(fetchMock).toHaveBeenCalledWith("/api/variant-runs/run-1", {
			cache: "no-store",
		});
		expect(container.querySelector(".status-pill")?.textContent).toBe(
			"succeeded",
		);
		expect(container.querySelector(".activity-card")?.className).toContain(
			"activity-card--succeeded",
		);
		expect(refreshMock).toHaveBeenCalledTimes(1);
	});
});
