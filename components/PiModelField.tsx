"use client";

import { useEffect, useId, useState } from "react";
import { fetchPiModelSuggestions } from "@/lib/pi-models-client";

interface PiModelFieldProps {
	value: string;
	onChange: (model: string) => void;
}

export function PiModelField({ value, onChange }: PiModelFieldProps) {
	const listId = useId();
	const [options, setOptions] = useState<string[]>(["pi-default"]);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState("");

	useEffect(() => {
		let active = true;
		setLoading(true);
		setLoadError("");
		void (async () => {
			try {
				const values = await fetchPiModelSuggestions();
				if (!active) return;
				setOptions(values);
				setLoading(false);
			} catch {
				if (!active) return;
				setLoadError("Suggestions unavailable — you can still type a model.");
				setLoading(false);
			}
		})();
		return () => {
			active = false;
		};
	}, []);

	return (
		<label className="field">
			Model
			<input
				className="model-combobox"
				type="text"
				list={listId}
				value={value}
				placeholder="e.g. cursor/composer-2.5"
				onChange={(event) => onChange(event.target.value)}
				autoComplete="off"
				spellCheck={false}
				aria-busy={loading}
			/>
			<datalist id={listId}>
				{options.map((option) => (
					<option key={option} value={option} />
				))}
			</datalist>
			{loadError ? (
				<p className="field-note field-note--warn">{loadError}</p>
			) : null}
		</label>
	);
}
