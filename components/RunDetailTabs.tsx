"use client";

import { useState, type ReactNode } from "react";

const tabs = [
	{ id: "preview", label: "Before / After" },
	{ id: "code", label: "Code diff" },
	{ id: "validation", label: "Validation" },
	{ id: "transcript", label: "Transcript" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function RunDetailTabs({
	panels,
}: {
	panels: Record<TabId, ReactNode>;
}) {
	const [active, setActive] = useState<TabId>("preview");
	return (
		<section className="studio-card run-tabs" aria-label="Run evidence tabs">
			<div className="tab-list" role="tablist" aria-label="Run evidence">
				{tabs.map((tab) => (
					<button
						key={tab.id}
						aria-controls={`panel-${tab.id}`}
						aria-selected={active === tab.id}
						className={
							active === tab.id ? "tab-button tab-button--active" : "tab-button"
						}
						id={`tab-${tab.id}`}
						onClick={() => setActive(tab.id)}
						role="tab"
						type="button"
					>
						{tab.label}
					</button>
				))}
			</div>
			{tabs.map((tab) => (
				<div
					aria-labelledby={`tab-${tab.id}`}
					hidden={active !== tab.id}
					id={`panel-${tab.id}`}
					key={tab.id}
					role="tabpanel"
				>
					{active === tab.id ? panels[tab.id] : null}
				</div>
			))}
		</section>
	);
}
