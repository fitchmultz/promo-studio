import type { ExecuteVariantRunOptions } from "@/lib/agent/types";

export type VariantRunExecutor = (
	runId: string,
	options?: ExecuteVariantRunOptions,
) => Promise<unknown>;

/** Fire-and-forget agent execution (Create Variant and API `after()`). */
export function scheduleVariantRunExecution(
	runId: string,
	execute: VariantRunExecutor,
	options?: ExecuteVariantRunOptions,
) {
	void execute(runId, options).catch(() => undefined);
}
