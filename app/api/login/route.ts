import { NextResponse } from "next/server";
import {
	createSessionToken,
	login,
	SESSION_COOKIE_NAME,
	sessionCookieOptions,
} from "@/lib/auth";
import { safeRedirectPath } from "@/lib/redirects";
import { isSameOriginPost, sameOriginResponseBaseUrl } from "@/lib/same-origin";

export async function POST(request: Request) {
	if (!isSameOriginPost(request)) {
		return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
	}
	const form = await request.formData();
	const email = String(form.get("email") ?? "");
	const password = String(form.get("password") ?? "");
	const nextPath = safeRedirectPath(form.get("next"));
	const user = await login(email, password);
	if (!user) {
		const errorUrl = new URL("/login", request.url);
		errorUrl.searchParams.set("error", "1");
		if (nextPath !== "/studio") errorUrl.searchParams.set("next", nextPath);
		return NextResponse.redirect(errorUrl, 303);
	}
	const response = NextResponse.redirect(
		new URL(nextPath, sameOriginResponseBaseUrl(request)),
		303,
	);
	response.cookies.set(
		SESSION_COOKIE_NAME,
		createSessionToken(user.id),
		sessionCookieOptions,
	);
	return response;
}
