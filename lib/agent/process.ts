import { spawn } from "node:child_process";
import { redactSecrets } from "@/lib/config";
import type { ProcessOptions, ProcessResult } from "@/lib/agent/types";

/** In-memory cap for subprocess stdout/stderr buffers (not the persisted transcript). */
export const MAX_PROCESS_OUTPUT_CHARS = 120_000;

/** Legacy SQLite tail heuristic: one buffer below {@link MAX_PROCESS_OUTPUT_CHARS}. */
export const LEGACY_TAIL_TRUNCATION_THRESHOLD =
	MAX_PROCESS_OUTPUT_CHARS - 1_000;

/** Live poll + DB fallback: recent JSONL lines only (full trace is on disk). */
export const MAX_POLL_TRANSCRIPT_CHARS = 800_000;

/** Max transcript stored in SQLite when the on-disk file is larger. */
export const MAX_DB_TRANSCRIPT_CHARS = 4_000_000;

/** Injected by an older build; filter from parsed events. */
export const LEGACY_TRANSCRIPT_TRUNCATED_MARKER =
	"[promo-studio: transcript truncated";

export function appendLimited(current: string, next: string) {
	const combined = current + next;
	if (combined.length <= MAX_PROCESS_OUTPUT_CHARS) return combined;
	return combined.slice(combined.length - MAX_PROCESS_OUTPUT_CHARS);
}

/**
 * Keep the most recent complete JSONL lines for live polling.
 * Drops oldest lines silently — never injects promo-studio markers into the stream.
 */
export function tailJsonlForPoll(full: string, maxChars: number): string {
	if (full.length <= maxChars) return full;
	const lines = full.split(/\r?\n/).filter((line) => line.trim());
	const kept: string[] = [];
	let size = 0;
	for (let index = lines.length - 1; index >= 0; index -= 1) {
		const line = lines[index] ?? "";
		const add = line.length + (kept.length ? 1 : 0);
		if (size + add > maxChars && kept.length > 0) break;
		kept.unshift(line);
		size += add;
	}
	return kept.length ? `${kept.join("\n")}\n` : "";
}

function emitLines(
	buffer: { value: string },
	chunk: string,
	emit?: (line: string) => void,
) {
	buffer.value += chunk;
	const lines = buffer.value.split(/\r?\n/);
	buffer.value = lines.pop() ?? "";
	for (const line of lines) {
		if (line.trim()) emit?.(redactSecrets(line));
	}
}

export function runProcess(
	command: string,
	args: string[],
	options: ProcessOptions,
): Promise<ProcessResult> {
	return new Promise((resolve) => {
		const child = spawn(command, args, {
			cwd: options.cwd,
			env: options.env ?? process.env,
			detached: true,
			stdio: ["pipe", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		let timedOut = false;
		let settled = false;
		const stdoutBuffer = { value: "" };
		const stderrBuffer = { value: "" };

		function killProcessGroup(signal: NodeJS.Signals) {
			if (!child.pid) return;
			try {
				process.kill(-child.pid, signal);
			} catch {
				child.kill(signal);
			}
		}

		function finish(result: ProcessResult) {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			if (stdoutBuffer.value.trim())
				options.onStdoutLine?.(redactSecrets(stdoutBuffer.value));
			if (stderrBuffer.value.trim())
				options.onStderrLine?.(redactSecrets(stderrBuffer.value));
			resolve(result);
		}

		const timer = setTimeout(() => {
			timedOut = true;
			killProcessGroup("SIGTERM");
			setTimeout(() => killProcessGroup("SIGKILL"), 1500).unref();
			finish({ code: null, stdout, stderr, timedOut: true });
		}, options.timeoutMs ?? 300_000);

		child.stdout.on("data", (chunk) => {
			const text = chunk.toString();
			stdout = appendLimited(stdout, text);
			emitLines(stdoutBuffer, text, options.onStdoutLine);
		});
		child.stderr.on("data", (chunk) => {
			const text = chunk.toString();
			stderr = appendLimited(stderr, text);
			emitLines(stderrBuffer, text, options.onStderrLine);
		});
		child.on("error", (error) => {
			finish({ code: 127, stdout, stderr: error.message, timedOut });
		});
		child.on("close", (code) => {
			finish({ code: timedOut ? null : code, stdout, stderr, timedOut });
		});
		child.stdin.end(options.input ?? "");
	});
}
