import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { runPiProcess, runPiRuntime } from "@/lib/agent/pi-adapter";

afterEach(() => vi.unstubAllEnvs());

it("the actual Pi subprocess rejects mismatched uppercase SRI before any model request", async () => {
	const body = "local security smoke response";
	let requests = 0;
	const server = createServer((_request, response) => {
		requests += 1;
		response.end(body);
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("No TCP port");
	const root = await mkdtemp(path.join(tmpdir(), "promo-pi-security-"));
	const extension = path.join(root, "security-smoke.ts");
	const digest = (value: string) =>
		createHash("sha256").update(value).digest("base64");
	try {
		// This native startup hook exercises Pi's effective global HTTP runtime.
		// It exits before inference; no provider, API credential, or live spend.
		await writeFile(
			extension,
			`export default function (pi) {
			pi.on("session_start", async () => {
				try {
					const url = ${JSON.stringify(`http://127.0.0.1:${address.port}/`)};
					const good = await fetch(url, { integrity: ${JSON.stringify(`SHA256-${digest(body)}`)} });
					if (await good.text() !== ${JSON.stringify(body)}) throw new Error("positive control failed");
					try {
						await fetch(url, { integrity: ${JSON.stringify(`SHA256-${digest("different trusted response")}`)} });
						console.log("UNSAFE_SRI_ACCEPTED");
						process.exit(1);
					} catch (error) {
						if (!String(error.cause).includes("integrity mismatch")) throw error;
						console.log("NATIVE_PI_SRI_REJECTED");
						process.exit(0);
					}
				} catch (error) {
					console.error(error);
					process.exit(2);
				}
			});
		}`,
		);
		await writeFile(
			path.join(root, "settings.json"),
			JSON.stringify({ extensions: [extension] }),
		);
		vi.stubEnv("PI_CODING_AGENT_DIR", root);
		vi.stubEnv("PI_OFFLINE", "1");
		vi.stubEnv("HOME", root);
		const result = await runPiRuntime({
			input: "",
			processRunner: runPiProcess,
			requestedModel: "openai/gpt-5.5",
			runId: "security-smoke",
			workspace: root,
			timeoutMs: 20_000,
		});
		expect(result.timedOut).toBe(false);
		// Pi routes extension console output to stderr in JSON mode.
		expect(result.stderr).toContain("NATIVE_PI_SRI_REJECTED");
		expect(result.stderr).not.toContain("UNSAFE_SRI_ACCEPTED");
		expect(result.code).toBe(0);
		expect(requests).toBe(2);
	} finally {
		server.closeAllConnections();
		await new Promise<void>((resolve, reject) =>
			server.close((error) => (error ? reject(error) : resolve())),
		);
		await rm(root, { recursive: true, force: true });
	}
}, 30_000);
