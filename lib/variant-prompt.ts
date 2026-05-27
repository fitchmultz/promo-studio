import type { Product } from "@prisma/client";
import { parseFeatures } from "@/lib/products";

export function buildVariantPrompt(params: {
	product: Product;
	campaignBrief: string;
	campaignGoal: string;
}) {
	const features = parseFeatures(params.product)
		.map((feature) => `- ${feature}`)
		.join("\n");
	return `You are Codex running as an autonomous software agent inside an isolated Vite storefront workspace.

Business intent:
Campaign goal: ${params.campaignGoal}
Campaign brief: ${params.campaignBrief}

Product facts that must remain true:
- Name: ${params.product.name}
- Price: ${params.product.price}
- SKU: RMT-001
- Inventory: 3
- Description: ${params.product.description}
- Features:\n${features}

Required autonomous workflow:
1. Read AGENTS.md, BRAND_RULES.md, package.json, src/product.ts, src/cart.ts, src/ProductPage.tsx, src/theme.ts, current components, src/styles.css, and tests before editing. Do not read node_modules or dist; they are generated/dependency artifacts.
2. Edit real source files under src/ to create a visibly different product page variant for the campaign. Do not return copy for the host app to render; write code.
3. Keep product price, SKU, inventory, cart API, package.json, and lockfiles unchanged.
4. Preserve the full product photo. Do not crop, stretch, filter, replace, or cover the tote image; keep the image CSS using max-width: 100%, max-height: 100%, min-width: 0, min-height: 0, and object-fit: contain so the whole product remains visible in the built preview.
5. Run npm test. If it fails, inspect the failure, edit code, and rerun until it passes.
6. Run npm run build. If it fails, inspect the failure, edit code, and rerun until it passes.
7. Do not attempt browser-based testing, visual inspection, or starting a local dev server. This isolated workspace cannot reliably bind ports or access a browser; rely on source review, npm test, npm run build, and the generated dist preview artifact.
8. Write artifact/manifest.json with this exact JSON shape:
{
  "summary": "one sentence summary of the code changes",
  "changedFiles": ["src/relative/path.tsx"],
  "commandsRun": ["npm test", "npm run build"],
  "testsPassed": true,
  "buildPassed": true,
  "commerceInvariantsPreserved": true,
  "previewPath": "dist/index.html"
}

The demo is designed to show real tool activity: file reads, file edits, command runs, fixes, tests, build, and manifest. Use workspace-write only within this directory.`;
}
