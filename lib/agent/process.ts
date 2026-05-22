import { spawn } from "node:child_process";
import { redactSecrets } from "@/lib/config";
import type { ProcessOptions, ProcessResult } from "@/lib/agent/types";

/** In-memory cap for subprocess stdout/stderr buffers (not the persisted transcript). */
export const MAX_PROCESS_OUTPUT_CHARS = 120000;

/** Persisted JSONL transcript cap (Pi runs can exceed 120k quickly). */
export const MAX_TRANSCRIPT_CHARS = 2_000_000;

export const TRANSCRIPT_TRUNCATED_MARKER =
	"[promo-studio: transcript truncated";

export function appendLimited(current: string, next: string) {
	const combined = current + next;
	if (combined.length <= MAX_PROCESS_OUTPUT_CHARS) return combined;
	return combined.slice(combined.length - MAX_PROCESS_OUTPUT_CHARS);
}

/** Grow transcript from the start; on overflow keep the head (session + early events). */
export function appendTranscript(current: string, next: string) {
	if (current.includes(TRANSCRIPT_TRUNCATED_MARKER)) return current;
	const combined = current + next;
	if (combined.length <= MAX_TRANSCRIPT_CHARS) return combined;
	const marker = `\n${TRANSCRIPT_TRUNCATED_MARKER} at ${MAX_TRANSCRIPT_CHARS} characters; earlier JSONL preserved]\n`;
	const headBudget = MAX_TRANSCRIPT_CHARS - marker.length;
	return combined.slice(0, headBudget) + marker;
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
