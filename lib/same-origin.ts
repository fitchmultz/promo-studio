/**
 * CSRF-style same-origin check for POST handlers.
 *
 * Next dev can normalize request URLs to localhost while a viewer opens the
 * same local server through 127.0.0.1. Treat loopback hostnames as equivalent
 * only when protocol and port match; all other origins must match exactly.
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

export function isSameOriginPost(request: Request) {
	const originHeader = request.headers.get("origin");
	if (!originHeader) return false;

	try {
		return sameOriginOrEquivalentLoopback(
			new URL(originHeader),
			new URL(request.url),
		);
	} catch {
		return false;
	}
}

export function sameOriginResponseBaseUrl(request: Request) {
	const originHeader = request.headers.get("origin");
	return originHeader && isSameOriginPost(request)
		? originHeader
		: new URL(request.url).origin;
}
