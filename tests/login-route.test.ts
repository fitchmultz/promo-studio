import { beforeEach, describe, expect, it, vi } from "vitest";

const loginMock = vi.fn();

vi.mock("@/lib/auth", () => ({
	createSessionToken: (userId: string) => `session-for-${userId}`,
	login: loginMock,
	SESSION_COOKIE_NAME: "promo_studio_session",
	sessionCookieOptions: {
		httpOnly: true,
		sameSite: "lax" as const,
		secure: false,
		maxAge: 28800,
		path: "/",
	},
}));

describe("login API route", () => {
	beforeEach(() => {
		loginMock.mockReset();
	});

	it("sets the session cookie on the product page redirect", async () => {
		loginMock.mockResolvedValue({ id: "user-123" });
		const { POST } = await import("@/app/api/login/route");
		const response = await POST(
			new Request("http://localhost:3000/api/login", {
				method: "POST",
				headers: { origin: "http://localhost:3000" },
				body: new URLSearchParams({
					email: "demo@promostudio.test",
					password: "promo-studio",
					next: "/proof",
				}),
			}),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(
			"http://localhost:3000/proof",
		);
		expect(response.headers.get("set-cookie")).toContain(
			"promo_studio_session=session-for-user-123",
		);
	});

	it("falls back to the product page when the next path is unsafe", async () => {
		loginMock.mockResolvedValue({ id: "user-123" });
		const { POST } = await import("@/app/api/login/route");
		for (const next of ["https://example.com/phish", "//example.com/phish"]) {
			const response = await POST(
				new Request("http://localhost:3000/api/login", {
					method: "POST",
					headers: { origin: "http://localhost:3000" },
					body: new URLSearchParams({
						email: "demo@promostudio.test",
						password: "promo-studio",
						next,
					}),
				}),
			);

			expect(response.status).toBe(303);
			expect(response.headers.get("location")).toBe(
				"http://localhost:3000/studio",
			);
		}
	});

	it("rejects cross-origin login requests before checking credentials", async () => {
		const { POST } = await import("@/app/api/login/route");
		const response = await POST(
			new Request("http://localhost:3000/api/login", {
				method: "POST",
				headers: {
					host: "localhost:3000",
					origin: "https://evil.example.com",
				},
				body: new URLSearchParams({
					email: "demo@promostudio.test",
					password: "promo-studio",
				}),
			}),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(
			"http://localhost:3000/login?error=1",
		);
		expect(loginMock).not.toHaveBeenCalled();
	});

	it("accepts login when Origin matches request URL origin even if Host header differs", async () => {
		loginMock.mockResolvedValue({ id: "user-123" });
		const { POST } = await import("@/app/api/login/route");
		const response = await POST(
			new Request("http://localhost:3000/api/login", {
				method: "POST",
				headers: {
					host: "unexpected-host.internal",
					origin: "http://localhost:3000",
				},
				body: new URLSearchParams({
					email: "demo@promostudio.test",
					password: "promo-studio",
				}),
			}),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(
			"http://localhost:3000/studio",
		);
		expect(loginMock).toHaveBeenCalledOnce();
	});

	it("keeps the loopback origin in the redirect when viewer opens 127.0.0.1", async () => {
		loginMock.mockResolvedValue({ id: "user-123" });
		const { POST } = await import("@/app/api/login/route");
		const response = await POST(
			new Request("http://localhost:3000/api/login", {
				method: "POST",
				headers: { origin: "http://127.0.0.1:3000" },
				body: new URLSearchParams({
					email: "demo@promostudio.test",
					password: "promo-studio",
				}),
			}),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(
			"http://127.0.0.1:3000/studio",
		);
		expect(response.headers.get("set-cookie")).toContain(
			"promo_studio_session=",
		);
	});

	it("accepts login from HTML forms that omit Origin but send Sec-Fetch-Site", async () => {
		loginMock.mockResolvedValue({ id: "user-123" });
		const { POST } = await import("@/app/api/login/route");
		const response = await POST(
			new Request("http://localhost:3000/api/login", {
				method: "POST",
				headers: { "sec-fetch-site": "same-origin" },
				body: new URLSearchParams({
					email: "demo@promostudio.test",
					password: "promo-studio",
				}),
			}),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(
			"http://localhost:3000/studio",
		);
		expect(loginMock).toHaveBeenCalledOnce();
	});

	it("accepts login without Host header when Origin matches request URL", async () => {
		loginMock.mockResolvedValue({ id: "user-123" });
		const { POST } = await import("@/app/api/login/route");
		const response = await POST(
			new Request("http://localhost:3000/api/login", {
				method: "POST",
				headers: {
					origin: "http://localhost:3000",
				},
				body: new URLSearchParams({
					email: "demo@promostudio.test",
					password: "promo-studio",
				}),
			}),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(
			"http://localhost:3000/studio",
		);
		expect(loginMock).toHaveBeenCalledOnce();
	});

	it("does not set a session cookie for invalid credentials", async () => {
		loginMock.mockResolvedValue(null);
		const { POST } = await import("@/app/api/login/route");
		const response = await POST(
			new Request("http://localhost:3000/api/login", {
				method: "POST",
				headers: { origin: "http://localhost:3000" },
				body: new URLSearchParams({
					email: "demo@promostudio.test",
					password: "wrong-password",
				}),
			}),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(
			"http://localhost:3000/login?error=1",
		);
		expect(response.headers.get("set-cookie")).toBeNull();
	});
});
