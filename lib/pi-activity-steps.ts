import { formatShellCommandForDisplay } from "@/lib/agent-display";

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

export interface PiThinkingAction {
	action: string;
	kind: "read" | "edit" | "write" | "shell" | "other";
}

/** One actionable line extracted from Pi thinking partials (cursor-sdk style). */
export function classifyThinkingActionLine(
	line: string,
): PiThinkingAction | null {
	const trimmed = line.trim();
	if (!trimmed || isProductNoiseLine(trimmed)) return null;
	if (/^read\s+\S/i.test(trimmed)) {
		const path = trimmed.replace(/^read\s+/i, "").trim();
		return { action: `read ${shortenPath(path)}`, kind: "read" };
	}
	if (/^edit\s+\S/i.test(trimmed)) {
		const path = trimmed.replace(/^edit\s+/i, "").trim();
		return { action: `edit ${shortenPath(path)}`, kind: "edit" };
	}
	if (/^write\s+\S/i.test(trimmed)) {
		const path = trimmed.replace(/^write\s+/i, "").trim();
		return { action: `write ${shortenPath(path)}`, kind: "write" };
	}
	if (trimmed.startsWith("$ ")) {
		return {
			action: formatShellCommandForDisplay(trimmed),
			kind: "shell",
		};
	}
	if (/^(npm test|npm run build|npm run dev)\b/.test(trimmed)) {
		return {
			action: formatShellCommandForDisplay(`$ ${trimmed}`),
			kind: "shell",
		};
	}
	if (/^\$\s/.test(trimmed)) {
		return {
			action: formatShellCommandForDisplay(trimmed.replace(/^\$\s*/, "$ ")),
			kind: "shell",
		};
	}
	if (/^glob\s+/i.test(trimmed)) {
		return {
			action: formatShellCommandForDisplay(`$ ${trimmed}`),
			kind: "shell",
		};
	}
	return null;
}

export function extractThinkingActions(text: string): PiThinkingAction[] {
	const seen = new Set<string>();
	const out: PiThinkingAction[] = [];
	for (const line of text.split(/\r?\n/)) {
		const classified = classifyThinkingActionLine(line);
		if (!classified || seen.has(classified.action)) continue;
		seen.add(classified.action);
		out.push(classified);
	}
	return out;
}

/** Codex-parity labels for demo activity stream. */
export function labelForPiActionStart(action: PiThinkingAction): string {
	const lower = action.action.toLowerCase();
	if (lower.startsWith("read ")) return "Read file";
	if (lower.startsWith("edit ")) return "File edit started";
	if (lower.startsWith("write ")) return "Write file";
	if (lower.includes("npm test")) return "Running tests";
	if (lower.includes("npm run build")) return "Building preview";
	if (lower.startsWith("$")) return "Shell command started";
	return "Tool";
}

export function labelForPiActionEnd(action: PiThinkingAction): string {
	const lower = action.action.toLowerCase();
	if (lower.startsWith("read ")) return "Read file completed";
	if (lower.startsWith("edit ")) return "File edit completed";
	if (lower.startsWith("write ")) return "Write file completed";
	if (lower.includes("npm test")) return "Tests completed";
	if (lower.includes("npm run build")) return "Build completed";
	if (lower.startsWith("$")) return "Shell command completed";
	return "Tool finished";
}

export function summarizeAssistantProse(text: string, maxLen = 120): string {
	const trimmed = text.trim().replace(/\s+/g, " ");
	if (!trimmed) return "";
	const first = trimmed.split(/(?<=[.!?])\s+/)[0] ?? trimmed;
	if (first.length <= maxLen) return first;
	return `${first.slice(0, maxLen - 1)}…`;
}
