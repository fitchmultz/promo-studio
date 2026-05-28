/** Strip undefined entries before passing a child-process environment. */
export function toProcessEnv(
	record: Record<string, string | undefined>,
): NodeJS.ProcessEnv {
	const entries = Object.entries(record).filter(
		(entry): entry is [string, string] => typeof entry[1] === "string",
	);
	return Object.fromEntries(entries) as NodeJS.ProcessEnv;
}
