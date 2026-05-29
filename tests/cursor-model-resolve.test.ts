import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCursorModelSelection } from "@/lib/cursor-runtime-config";

describe("Cursor model selection", () => {
	afterEach(() => {
		vi.doUnmock("@cursor/sdk");
	});

	it("maps composer-2.5-fast to composer-2.5 with fast=true", () => {
		expect(parseCursorModelSelection("composer-2.5-fast")).toEqual({
			id: "composer-2.5",
			params: [{ id: "fast", value: "true" }],
		});
	});

	it("keeps fast enabled when resolving against models.list", async () => {
		vi.doMock("@cursor/sdk", () => ({
			Cursor: {
				models: {
					list: async () => [
						{
							id: "composer-2.5",
							parameters: [
								{
									id: "fast",
									values: [{ value: "false" }, { value: "true" }],
								},
							],
						},
					],
				},
			},
		}));
		const { resolveCursorModelSelection } = await import(
			"@/lib/cursor-model-resolve"
		);
		const selection = await resolveCursorModelSelection(
			"test-key",
			"composer-2.5-fast",
		);
		expect(selection).toEqual({
			id: "composer-2.5",
			params: [{ id: "fast", value: "true" }],
		});
	});

	it("returns parsed selection when models.list is unavailable", async () => {
		vi.doMock("@cursor/sdk", () => ({
			Cursor: {
				models: {
					list: async () => {
						throw new Error("network unavailable");
					},
				},
			},
		}));
		const { resolveCursorModelSelection } = await import(
			"@/lib/cursor-model-resolve"
		);
		const selection = await resolveCursorModelSelection(
			"test-key",
			"composer-2.5-fast",
		);
		expect(selection).toEqual(parseCursorModelSelection("composer-2.5-fast"));
	});

	it("throws when the requested model is not available for the API key", async () => {
		vi.doMock("@cursor/sdk", () => ({
			Cursor: {
				models: {
					list: async () => [{ id: "other-model" }],
				},
			},
		}));
		const { resolveCursorModelSelection } = await import(
			"@/lib/cursor-model-resolve"
		);
		await expect(
			resolveCursorModelSelection("test-key", "composer-2.5-fast"),
		).rejects.toThrow(/not available/i);
	});
});
