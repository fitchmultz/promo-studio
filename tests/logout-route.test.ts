import { beforeEach, describe, expect, it, vi } from "vitest";

const logoutMock = vi.fn();

vi.mock("@/lib/auth", () => ({
	logout: logoutMock,
	SESSION_COOKIE_NAME: "promo_studio_session",
}));

describe("logout API route", () => {
	beforeEach(() => {
		logoutMock.mockReset();
	});

	it("rejects cross-origin logout requests without clearing the session", async () => {
		const { POST } = await import("@/app/api/logout/route");
		const response = await POST(
			new Request("http://localhost:3000/api/logout", {
				method: "POST",
				headers: {
					host: "localhost:3000",
					origin: "https://evil.example.com",
				},
			}),
		);

		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toEqual({
			error: "Cross-origin requests are not accepted.",
		});
		expect(logoutMock).not.toHaveBeenCalled();
	});

	it("clears the session for same-origin logout requests", async () => {
		const { POST } = await import("@/app/api/logout/route");
		const response = await POST(
			new Request("http://localhost:3000/api/logout", {
				method: "POST",
				headers: {
					host: "localhost:3000",
					origin: "http://localhost:3000",
				},
			}),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(
			"http://localhost:3000/login",
		);
		expect(response.headers.get("set-cookie")).toContain(
			"promo_studio_session=",
		);
		expect(logoutMock).toHaveBeenCalledOnce();
	});

	it("clears the session when Origin matches request URL without Host header", async () => {
		const { POST } = await import("@/app/api/logout/route");
		const response = await POST(
			new Request("http://localhost:3000/api/logout", {
				method: "POST",
				headers: {
					origin: "http://localhost:3000",
				},
			}),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(
			"http://localhost:3000/login",
		);
		expect(logoutMock).toHaveBeenCalledOnce();
	});

	it("allows logout when Origin matches URL origin even if Host header differs", async () => {
		const { POST } = await import("@/app/api/logout/route");
		const response = await POST(
			new Request("http://localhost:3000/api/logout", {
				method: "POST",
				headers: {
					host: "unexpected-host.internal",
					origin: "http://localhost:3000",
				},
			}),
		);

		expect(response.status).toBe(303);
		expect(logoutMock).toHaveBeenCalledOnce();
	});
});
