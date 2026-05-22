import type { CSSProperties } from "react";
import type { RunPhaseState } from "@/lib/run-phase";

export function RunPhaseStepper({ phase }: { phase: RunPhaseState }) {
	if (phase.id === "failed") {
		return (
			<p className="run-phase run-phase--failed" role="status">
				{phase.label}
			</p>
		);
	}
	return (
		<div className="run-phase" role="status" aria-live="polite">
			<p className="run-phase__label">
				<span className="run-phase__step">
					Step {phase.step} of {phase.total}
				</span>
				{phase.label}
			</p>
			<div
				className="run-phase__bar"
				aria-hidden="true"
				style={
					{
						"--run-phase-progress": `${Math.round((phase.step / phase.total) * 100)}%`,
					} as CSSProperties
				}
			/>
		</div>
	);
}
