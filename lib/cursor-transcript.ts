import {
	localRunStreamEventToSdkMessage,
	type LocalRunStreamEvent,
	type SDKMessage,
} from "@cursor/sdk";
import { isJsonObject } from "@/lib/json";

function isSdkMessage(
	value: Record<string, unknown>,
): value is SDKMessage & Record<string, unknown> {
	return (
		typeof value.type === "string" &&
		typeof value.agent_id === "string" &&
		typeof value.run_id === "string"
	);
}

/** Unwrap `LocalRunStreamEvent` rows persisted before normalization. */
export function unwrapCursorSdkMessage(
	parsed: Record<string, unknown>,
): Record<string, unknown> {
	if (parsed.type === "sdk_message" && isJsonObject(parsed.message)) {
		return parsed.message;
	}
	return parsed;
}

/** Map a `run.stream()` event to the JSONL payload Promo Studio stores and displays. */
export function cursorStreamEventToTranscriptPayload(event: unknown): unknown {
	if (isJsonObject(event) && isSdkMessage(event)) {
		return event;
	}
	const sdkMessage = localRunStreamEventToSdkMessage(
		event as LocalRunStreamEvent,
	);
	if (sdkMessage) return sdkMessage;
	if (isJsonObject(event)) return unwrapCursorSdkMessage(event);
	return event;
}

export function cursorStreamEventToTranscriptLine(event: unknown): string {
	const payload = cursorStreamEventToTranscriptPayload(event);
	return JSON.stringify(payload);
}
