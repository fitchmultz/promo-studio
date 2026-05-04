export function safeRedirectPath(
	raw: FormDataEntryValue | string | null | undefined,
	fallback = "/studio",
) {
	const value = String(raw ?? "").trim();
	if (
		!value?.startsWith("/") ||
		value.startsWith("//") ||
		value.includes("://") ||
		value.includes("\\")
	) {
		return fallback;
	}
	return value;
}
