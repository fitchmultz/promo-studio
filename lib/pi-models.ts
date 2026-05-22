export interface PiModelOption {
	value: string;
	label: string;
	provider: string;
}

export interface PiModelsListResult {
	models: PiModelOption[];
	error?: string;
}

/** List Pi models with configured auth via ModelRegistry (server-only). */
export async function listAvailablePiModels(): Promise<PiModelsListResult> {
	try {
		const pi = await import("@earendil-works/pi-coding-agent");
		const authStorage = pi.AuthStorage.create();
		const modelRegistry = pi.ModelRegistry.create(authStorage);
		const registryError = modelRegistry.getError();
		const available = await Promise.resolve(modelRegistry.getAvailable());

		const models: PiModelOption[] = [
			{
				value: "pi-default",
				label: "Default",
				provider: "",
			},
		];
		const seen = new Set<string>(["pi-default"]);

		for (const model of available) {
			const value = `${model.provider}/${model.id}`;
			if (seen.has(value)) continue;
			seen.add(value);
			models.push({
				value,
				label: value,
				provider: model.provider,
			});
		}

		models.sort((a, b) => {
			if (!a.provider) return -1;
			if (!b.provider) return 1;
			const provider = a.provider.localeCompare(b.provider);
			if (provider !== 0) return provider;
			return a.value.localeCompare(b.value);
		});

		return {
			models,
			error: registryError,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			models: [
				{
					value: "pi-default",
					label: "Default",
					provider: "",
				},
			],
			error: message,
		};
	}
}
