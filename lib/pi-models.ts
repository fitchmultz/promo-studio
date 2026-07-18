import { PI_DEFAULT_MODEL } from "@/lib/pi-runtime-config";

export interface PiModelOption {
	value: string;
	label: string;
	provider: string;
}

export interface PiModelsListResult {
	models: PiModelOption[];
	error?: string;
}

/** List Pi models with configured auth via ModelRuntime (server-only). */
export async function listAvailablePiModels(): Promise<PiModelsListResult> {
	try {
		const pi = await import("@earendil-works/pi-coding-agent");
		const modelRuntime = await pi.ModelRuntime.create({
			allowModelNetwork: false,
		});
		const registryError = modelRuntime.getError();
		const available = await modelRuntime.getAvailable();

		const models: PiModelOption[] = [
			{
				value: PI_DEFAULT_MODEL,
				label: "Default",
				provider: "",
			},
		];
		const seen = new Set<string>([PI_DEFAULT_MODEL]);

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
					value: PI_DEFAULT_MODEL,
					label: "Default",
					provider: "",
				},
			],
			error: message,
		};
	}
}
