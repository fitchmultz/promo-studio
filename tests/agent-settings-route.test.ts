import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserMock = vi.fn();
const findUniqueMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/lib/auth", () => ({ requireUser: requireUserMock }));
vi.mock("@/lib/db", () => ({
	prisma: {
		user: {
			findUnique: findUniqueMock,
			update: updateMock,
		},
	},
}));

describe("agent settings API", () => {
	beforeEach(() => {
		requireUserMock.mockReset().mockResolvedValue({ id: "user-1" });
		findUniqueMock.mockReset().mockResolvedValue({ agentPreferences: "" });
		updateMock.mockReset().mockResolvedValue({});
	});

	it("stores canonical settings derived from the runtime spec", async () => {
		const { PUT } = await import("@/app/api/agent/settings/route");
		const response = await PUT(
			new Request("http://localhost/api/agent/settings", {
				method: "PUT",
				body: JSON.stringify({
					agentCore: "pi",
					agentHarness: "json",
					model: "cursor/composer-2.5",
					reasoningEffort: "anything-ignored",
					authMode: "auto",
				}),
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			settings: {
				agentCore: "pi",
				agentHarness: "json",
				model: "cursor/composer-2.5",
				reasoningEffort: "codex-default",
				authMode: "auto",
			},
		});
		expect(updateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				data: {
					agentPreferences: JSON.stringify({
						agentCore: "pi",
						agentHarness: "json",
						model: "cursor/composer-2.5",
						reasoningEffort: "codex-default",
						authMode: "auto",
					}),
				},
			}),
		);
	});

	it("rejects invalid runtime settings instead of storing loose strings", async () => {
		const { PUT } = await import("@/app/api/agent/settings/route");
		const response = await PUT(
			new Request("http://localhost/api/agent/settings", {
				method: "PUT",
				body: JSON.stringify({
					agentCore: "codex",
					agentHarness: "json",
					model: "gpt-5.5",
					reasoningEffort: "low",
					authMode: "auto",
				}),
			}),
		);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			error: "Invalid Codex harness: json.",
		});
		expect(updateMock).not.toHaveBeenCalled();
	});
});
