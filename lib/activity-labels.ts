export function shellMilestoneLabel(
	command: string,
	phase: "start" | "end",
): string | null {
	const lower = command.toLowerCase();
	if (lower.includes("npm test")) {
		return phase === "start" ? "Running tests" : "Tests completed";
	}
	if (lower.includes("npm run build")) {
		return phase === "start" ? "Building preview" : "Build completed";
	}
	return null;
}

export function codexStyleToolLabel(
	toolName: string,
	phase: "start" | "end",
	isError?: boolean,
	command?: string,
): string {
	if (toolName === "bash" && command) {
		const milestone = shellMilestoneLabel(command, phase);
		if (milestone) return milestone;
		return phase === "start"
			? "Shell command started"
			: isError
				? "Shell command failed"
				: "Shell command completed";
	}
	if (toolName === "edit" || toolName === "write") {
		return phase === "start" ? "File edit started" : "File edit completed";
	}
	if (toolName === "read") {
		return phase === "start" ? "Read file" : "Read file completed";
	}
	return phase === "start"
		? "Tool started"
		: isError
			? "Tool failed"
			: "Tool finished";
}

/** Codex-parity labels for Pi thinking actions and tool steps. */
export function labelForActionStart(action: string): string {
	const lower = action.toLowerCase();
	if (lower.startsWith("read ")) return "Read file";
	if (lower.startsWith("edit ")) return "File edit started";
	if (lower.startsWith("write ")) return "Write file";
	if (lower.includes("npm test")) return "Running tests";
	if (lower.includes("npm run build")) return "Building preview";
	if (lower.startsWith("$")) return "Shell command started";
	return "Tool";
}

export function labelForActionEnd(action: string): string {
	const lower = action.toLowerCase();
	if (lower.startsWith("read ")) return "Read file completed";
	if (lower.startsWith("edit ")) return "File edit completed";
	if (lower.startsWith("write ")) return "Write file completed";
	if (lower.includes("npm test")) return "Tests completed";
	if (lower.includes("npm run build")) return "Build completed";
	if (lower.startsWith("$")) return "Shell command completed";
	return "Tool finished";
}
