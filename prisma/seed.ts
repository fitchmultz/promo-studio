import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { serializeAgentSettings } from "../lib/agent-settings-runtime";
import { prisma } from "../lib/db";
import { createVariantWorkspace } from "../lib/workspace";

const DEMO_AGENT_PREFERENCES = serializeAgentSettings({
	agentCore: "pi",
	agentHarness: "json",
	model: "cursor/composer-2.5",
	reasoningEffort: "codex-default",
	authMode: "auto",
});

const SEEDED_RUN_ID = "seeded-demo-variant";

const product = {
	id: "ribbed-market-tote",
	slug: "ribbed-market-tote",
	name: "Ribbed Market Tote",
	price: "$42.00",
	description:
		"A sturdy everyday tote crafted from organic cotton canvas with reinforced handles and interior pocket.",
	features: JSON.stringify([
		"100% organic cotton canvas",
		"Reinforced handles rated to 40 lbs",
		"Interior zip pocket",
		"Machine washable",
		"Naturally dyed",
	]),
	imageSrc: "/products/ribbed-market-tote.webp",
};

function seededPreviewHtml() {
	return `<!doctype html><html><head><style>body{margin:0;font-family:Inter,Arial,sans-serif;background:#10231d;color:#fff}.wrap{max-width:980px;margin:0 auto;padding:44px 24px}.hero{display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:center}.art{height:360px;border-radius:28px;background:#fff8e5;display:grid;place-items:center;overflow:hidden}.art img{display:block;width:auto;max-width:100%;height:auto;max-height:100%;min-width:0;min-height:0;object-fit:contain}.eyebrow{color:#f6dfb4;text-transform:uppercase;font-weight:800}h1{font-size:54px;line-height:.95;margin:0 0 18px}.price{font-size:30px}.panel{margin-top:24px;background:#fff;color:#10231d;border-radius:22px;padding:24px}button{min-height:48px;border:0;border-radius:999px;background:#f6dfb4;color:#10231d;font-weight:900;padding:0 24px}</style></head><body><main class="wrap"><section class="hero"><div><p class="eyebrow">Gift-ready commuter carry</p><h1>Carry the season without carrying waste.</h1><p>The Ribbed Market Tote turns office days, errands, and last-minute gifting into one durable ritual.</p><p class="price">$42.00</p><button>Add to cart</button></div><div class="art"><img src="/products/ribbed-market-tote.webp" alt="Ribbed Market Tote"></div></section><section class="panel"><h2>Why it works</h2><p>Organic cotton, reinforced handles, and a useful pocket make this a practical gift with a lighter footprint.</p><p>SKU: RMT-001 · 3 left in stock</p></section></main></body></html>`;
}

async function createSeededWorkspace() {
	const workspace = await createVariantWorkspace(SEEDED_RUN_ID);
	await writeFile(
		path.join(workspace, "src", "theme.ts"),
		`export const theme = {
  colors: {
    background: "#10231d",
    surface: "#fff8e5",
    border: "#d6c69c",
    text: "#ffffff",
    muted: "#d5eadf",
    action: "#f6dfb4",
  },
  fontFamily: "Inter, Arial, Helvetica, sans-serif",
  radius: "28px",
  maxWidth: "980px",
} as const;
`,
	);
	await writeFile(
		path.join(workspace, "src", "components", "GiftStory.tsx"),
		`export function GiftStory() {
  return (
    <section className="panel">
      <h2>Why it works</h2>
      <p>Organic cotton, reinforced handles, and a useful pocket make this a practical gift with a lighter footprint.</p>
      <p>SKU: RMT-001 · 3 left in stock</p>
    </section>
  );
}
`,
	);
	await writeFile(
		path.join(workspace, "src", "ProductPage.tsx"),
		`import { CallToAction } from "./components/CallToAction";
import { GiftStory } from "./components/GiftStory";
import { product } from "./product";

export function ProductPage() {
  return (
    <main className="page page--gift">
      <section className="hero hero--gift" aria-labelledby="product-title">
        <div>
          <p className="eyebrow">Gift-ready commuter carry</p>
          <h1 id="product-title">Carry the season without carrying waste.</h1>
          <p>The {product.name} turns office days, errands, and last-minute gifting into one durable ritual.</p>
          <CallToAction />
        </div>
        <div className="product-image product-image--gift">
          <img src={product.imageSrc} alt="Ribbed Market Tote" />
        </div>
      </section>
      <GiftStory />
    </main>
  );
}
`,
	);
	await mkdir(path.join(workspace, "dist"), { recursive: true });
	await writeFile(
		path.join(workspace, "dist", "index.html"),
		seededPreviewHtml(),
	);
	return workspace;
}

function transcript() {
	return [
		JSON.stringify({
			type: "item.started",
			item: { type: "file_read", name: "AGENTS.md" },
		}),
		JSON.stringify({
			type: "tool_call",
			item: { type: "file_read", name: "src/ProductPage.tsx" },
		}),
		JSON.stringify({
			type: "tool_call",
			item: { type: "file_write", name: "src/components/GiftStory.tsx" },
		}),
		JSON.stringify({
			type: "tool_call",
			item: { type: "shell_command", name: "npm test" },
		}),
		JSON.stringify({ type: "tool_output", item: { text: "Tests passed" } }),
		JSON.stringify({
			type: "tool_call",
			item: { type: "shell_command", name: "npm run build" },
		}),
		JSON.stringify({ type: "tool_output", item: { text: "Build passed" } }),
		JSON.stringify({
			type: "item.completed",
			item: { type: "agent_message", text: "Variant complete with manifest." },
		}),
	].join("\n");
}

async function main() {
	const workspace = await createSeededWorkspace();
	const passwordHash = await bcrypt.hash("promo-studio", 10);
	const user = await prisma.user.upsert({
		where: { email: "demo@promostudio.test" },
		update: {
			name: "Demo User",
			role: "admin",
			passwordHash,
			agentPreferences: DEMO_AGENT_PREFERENCES,
		},
		create: {
			email: "demo@promostudio.test",
			name: "Demo User",
			role: "admin",
			passwordHash,
			agentPreferences: DEMO_AGENT_PREFERENCES,
		},
	});
	await prisma.product.upsert({
		where: { id: product.id },
		update: product,
		create: product,
	});
	const manifest = {
		summary:
			"Seeded gift-focused storefront variant showing the expected completed receipt format.",
		changedFiles: [
			"src/ProductPage.tsx",
			"src/theme.ts",
			"src/components/GiftStory.tsx",
		],
		commandsRun: ["npm test", "npm run build"],
		testsPassed: true,
		buildPassed: true,
		commerceInvariantsPreserved: true,
		previewPath: "dist/index.html",
	};
	const validationResult =
		"Manifest summary: Seeded gift-focused storefront variant showing the expected completed receipt format.\nTests passed: yes\nBuild passed: yes\nCommerce invariants preserved: yes\nCommands: npm test | npm run build\nChanged files: src/ProductPage.tsx, src/theme.ts, src/components/GiftStory.tsx\nValidation: passed";
	const common = {
		productId: product.id,
		userId: user.id,
		status: "succeeded",
		campaignBrief:
			"Make the tote feel like a thoughtful low-waste gift for commuters.",
		campaignGoal: "Holiday gift push",
		workspacePath: workspace,
		manifest: JSON.stringify(manifest, null, 2),
		transcript: transcript(),
		stdout:
			"Seeded transcript demonstrates expected Codex JSONL activity shape.",
		stderr: "",
		testsPassed: true,
		buildPassed: true,
		commerceInvariantsOk: true,
		changedFiles: JSON.stringify(manifest.changedFiles),
		validationResult,
		error: null,
		outputSummary: manifest.summary,
		previewHtml: seededPreviewHtml(),
		agentCore: "codex",
		agentHarness: "sdk",
		codexRuntime: "sdk",
		completedAt: new Date(),
	};
	await prisma.variantRun.upsert({
		where: { id: SEEDED_RUN_ID },
		update: common,
		create: {
			id: SEEDED_RUN_ID,
			...common,
			requestedAuthMode: "auto",
			selectedAuthMode: "subscription",
			requestedModel: "codex-default",
			selectedModel: "codex-default",
			requestedEffort: "codex-default",
			selectedEffort: "codex-default",
			codexCommand: `Codex TypeScript SDK runStreamed workingDirectory=${common.workspacePath} sandboxMode=workspace-write skipGitRepoCheck=true model=codex-default modelReasoningEffort=codex-default`,
			inputPrompt:
				"Seeded demo data; create a live run from the studio to execute Codex.",
		},
	});
}

main()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
