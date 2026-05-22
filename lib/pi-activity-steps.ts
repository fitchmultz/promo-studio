/** Commerce copy that appears when Pi thinking embeds read file output — not real stream steps. */
const PRODUCT_NOISE_PATTERNS = [
	/^100% organic cotton/i,
	/^reinforced handles/i,
	/^interior zip pocket/i,
	/^machine washable/i,
	/^naturally dyed/i,
	/^ribbed market tote/i,
	/^sku:\s*rmt-001/i,
	/^\$42\.00/,
	/^3 left in stock/i,
	/^add to cart/i,
	/^everyday carry/i,
];

function isProductNoiseLine(line: string): boolean {
	const trimmed = line.trim();
	if (!trimmed || trimmed.length > 200) return false;
	return PRODUCT_NOISE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function shortenPath(path: string): string {
	const marker = "/storefront/";
	const index = path.indexOf(marker);
	if (index >= 0) return path.slice(index + marker.length);
	return path.split("/").pop() ?? path;
}

/** One actionable line extracted from Pi thinking partials (cursor-sdk style). */
export function classifyThinkingActionLine(line: string): string | null {
	const trimmed = line.trim();
	if (!trimmed || isProductNoiseLine(trimmed)) return null;
	if (/^read\s+\S/i.test(trimmed)) {
		const path = trimmed.replace(/^read\s+/i, "").trim();
		return `read ${shortenPath(path)}`;
	}
	if (/^edit\s+\S/i.test(trimmed)) {
		const path = trimmed.replace(/^edit\s+/i, "").trim();
		return `edit ${shortenPath(path)}`;
	}
	if (/^write\s+\S/i.test(trimmed)) {
		const path = trimmed.replace(/^write\s+/i, "").trim();
		return `write ${shortenPath(path)}`;
	}
	if (trimmed.startsWith("$ ")) return trimmed;
	if (/^(npm test|npm run build|npm run dev)\b/.test(trimmed)) return `$ ${trimmed}`;
	if (/^\$\s/.test(trimmed)) return trimmed.replace(/^\$\s*/, "$ ");
	if (/^glob\s+/i.test(trimmed)) return `$ ${trimmed}`;
	return null;
}

export function extractThinkingActions(text: string): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const line of text.split(/\r?\n/)) {
		const action = classifyThinkingActionLine(line);
		if (!action || seen.has(action)) continue;
		seen.add(action);
		out.push(action);
	}
	return out;
}

/** Codex-parity labels for demo activity stream. */
export function labelForPiAction(action: string): string {
	const lower = action.toLowerCase();
	if (lower.startsWith("read ")) return "Read file";
	if (lower.startsWith("edit ")) return "File edit started";
	if (lower.startsWith("write ")) return "Write file";
	if (lower.includes("npm test")) return "Shell command started";
	if (lower.includes("npm run build")) return "Shell command started";
	if (lower.startsWith("$")) return "Shell command started";
	return "Tool";
}

export function summarizeAssistantProse(text: string, maxLen = 140): string {
	const trimmed = text.trim().replace(/\s+/g, " ");
	if (!trimmed) return "";
	const first = trimmed.split(/(?<=[.!?])\s+/)[0] ?? trimmed;
	if (first.length <= maxLen) return first;
	return `${first.slice(0, maxLen - 1)}…`;
}
