import type { ExecuteVariantRunOptions } from "@/lib/agent/types";

export type VariantRunExecutor = (
	runId: string,
	options?: ExecuteVariantRunOptions,
) => Promise<unknown>;

export type VariantRunScheduler = (
	task: () => Promise<unknown> | unknown,
) => void;

function reportScheduleFailure(runId: string, error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(
		`Variant run ${runId} execution failed after scheduling: ${message}`,
	);
}

/** Schedule agent execution behind an injected host scheduler (Next `after`, timers, or tests). */
export function scheduleVariantRunExecution(
	runId: string,
	execute: VariantRunExecutor,
	options?: ExecuteVariantRunOptions,
	scheduler: VariantRunScheduler = (task) => {
		queueMicrotask(() => {
			void Promise.resolve(task()).catch(() => undefined);
		});
	},
) {
	scheduler(() =>
		execute(runId, options).catch((error: unknown) => {
			reportScheduleFailure(runId, error);
			throw error;
		}),
	);
}
