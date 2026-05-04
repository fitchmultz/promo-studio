import { describe, expect, it } from "vitest";
import { isSameOriginPost, sameOriginResponseBaseUrl } from "@/lib/same-origin";

describe("same-origin POST guard", () => {
	it("rejects requests without an Origin header", () => {
		const request = new Request("http://localhost:3000/api/login", {
			method: "POST",
		});
		expect(isSameOriginPost(request)).toBe(false);
	});

	it("accepts equivalent loopback hosts on the same protocol and port", () => {
		const request = new Request("http://localhost:3000/api/login", {
			method: "POST",
			headers: { origin: "http://127.0.0.1:3000" },
		});
		expect(isSameOriginPost(request)).toBe(true);
	});

	it("rejects different non-loopback origins", () => {
		const request = new Request("http://localhost:3000/api/login", {
			method: "POST",
			headers: { origin: "https://evil.example.com" },
		});
		expect(isSameOriginPost(request)).toBe(false);
	});

	it("uses the accepted Origin as the response base URL", () => {
		const request = new Request("http://localhost:3000/api/login", {
			method: "POST",
			headers: { origin: "http://127.0.0.1:3000" },
		});

		expect(sameOriginResponseBaseUrl(request)).toBe("http://127.0.0.1:3000");
	});

	it("falls back to the request URL for rejected origins", () => {
		const request = new Request("http://localhost:3000/api/login", {
			method: "POST",
			headers: { origin: "https://evil.example.com" },
		});

		expect(sameOriginResponseBaseUrl(request)).toBe("http://localhost:3000");
	});
});
