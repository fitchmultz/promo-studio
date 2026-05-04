import { NextResponse } from "next/server";
import { logout, SESSION_COOKIE_NAME } from "@/lib/auth";
import { isSameOriginPost, sameOriginResponseBaseUrl } from "@/lib/same-origin";

export async function POST(request: Request) {
	if (!isSameOriginPost(request)) {
		return NextResponse.json(
			{ error: "Cross-origin requests are not accepted." },
			{ status: 403 },
		);
	}
	await logout();
	const response = NextResponse.redirect(
		new URL("/login", sameOriginResponseBaseUrl(request)),
		303,
	);
	response.cookies.delete(SESSION_COOKIE_NAME);
	return response;
}
