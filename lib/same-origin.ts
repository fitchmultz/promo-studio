/**
 * CSRF-style same-origin check for POST handlers.
 *
 * Next dev can normalize request URLs to localhost while a viewer opens the
 * same local server through 127.0.0.1. Treat loopback hostnames as equivalent
 * only when protocol and port match; all other origins must match exactly.
 *
 * HTML form POSTs often omit `Origin`; modern browsers send `Sec-Fetch-Site`
 * and `Referer` instead.
 */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function sameOriginOrEquivalentLoopback(origin: URL, expected: URL) {
	if (origin.origin === expected.origin) return true;
	return (
		origin.protocol === expected.protocol &&
		origin.port === expected.port &&
		LOOPBACK_HOSTS.has(origin.hostname) &&
		LOOPBACK_HOSTS.has(expected.hostname)
	);
}

function matchesRequestUrl(candidate: string, requestUrl: string) {
	try {
		return sameOriginOrEquivalentLoopback(
			new URL(candidate),
			new URL(requestUrl),
		);
	} catch {
		return false;
	}
}

export function isSameOriginPost(request: Request) {
	const requestUrl = request.url;
	const originHeader = request.headers.get("origin");
	if (originHeader) {
		return matchesRequestUrl(originHeader, requestUrl);
	}

	const secFetchSite = request.headers.get("sec-fetch-site");
	if (secFetchSite === "same-origin") {
		return true;
	}

	const referer = request.headers.get("referer");
	if (referer) {
		return matchesRequestUrl(referer, requestUrl);
	}

	return false;
}

export function sameOriginResponseBaseUrl(request: Request) {
	const originHeader = request.headers.get("origin");
	if (originHeader && matchesRequestUrl(originHeader, request.url)) {
		return originHeader;
	}

	const referer = request.headers.get("referer");
	if (referer && matchesRequestUrl(referer, request.url)) {
		return new URL(referer).origin;
	}

	return new URL(request.url).origin;
}
