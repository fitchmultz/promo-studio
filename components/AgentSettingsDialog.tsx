"use client";

import { useEffect, useRef } from "react";
import { AgentSettingsFields } from "@/components/AgentSettingsFields";
import { useAgentSettings } from "@/components/AgentSettingsProvider";

export function AgentSettingsDialog() {
	const { settings, updateSettings, dialogOpen, closeDialog } =
		useAgentSettings();
	const dialogRef = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;
		if (dialogOpen && !dialog.open) dialog.showModal();
		if (!dialogOpen && dialog.open) dialog.close();
	}, [dialogOpen]);

	return (
		<dialog
			ref={dialogRef}
			className="settings-dialog"
			aria-labelledby="agent-settings-title"
			onClose={closeDialog}
			onCancel={closeDialog}
		>
			<form method="dialog" className="settings-dialog__panel studio-card">
				<header className="settings-dialog__header">
					<div>
						<p className="section-kicker">Demo configuration</p>
						<h2 id="agent-settings-title">Agent settings</h2>
					</div>
					<button
						className="icon-button"
						type="submit"
						aria-label="Close agent settings"
					>
						×
					</button>
				</header>
				<AgentSettingsFields settings={settings} onChange={updateSettings} />
				<menu className="settings-dialog__actions">
					<button className="button primary-button" type="submit">
						Done
					</button>
				</menu>
			</form>
		</dialog>
	);
}
