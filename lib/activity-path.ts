const STOREFRONT_MARKER = "/storefront/";

/** Shorten absolute workspace paths for activity stream labels. */
export function shortenStorefrontPath(filePath: string): string {
	const index = filePath.indexOf(STOREFRONT_MARKER);
	if (index >= 0) return filePath.slice(index + STOREFRONT_MARKER.length);
	const runMarker = "/run-";
	const runIndex = filePath.indexOf(runMarker);
	if (runIndex >= 0) {
		const tail = filePath.slice(runIndex + 1);
		const slash = tail.indexOf("/");
		return slash >= 0 ? tail.slice(slash + 1) : tail;
	}
	return filePath.split("/").pop() ?? filePath;
}

/** Codex file_change entries use storefront-relative paths when possible. */
export function shortenCodexFileChangePath(filePath: string): string {
	const index = filePath.indexOf(STOREFRONT_MARKER);
	return index >= 0
		? filePath.slice(index + STOREFRONT_MARKER.length)
		: filePath;
}
