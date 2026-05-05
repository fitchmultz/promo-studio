import type { Product } from "@prisma/client";
import { parseFeatures } from "@/lib/products";

function escapeHtml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function beforeHtml(product: Product) {
	const features = parseFeatures(product)
		.map((feature) => `<li>${escapeHtml(feature)}</li>`)
		.join("");
	return `<!doctype html><html><head><style>body{font-family:Arial,sans-serif;margin:0;color:#222;background:#fff}.page{max-width:980px;margin:0 auto;padding:32px 20px}.hero{display:grid;grid-template-columns:1fr 1fr;gap:24px;border-bottom:1px solid #ddd;padding-bottom:24px}.image{display:grid;height:360px;place-items:center;background:#f7f7f7;border:1px solid #ddd;overflow:hidden}.image img{display:block;width:auto;max-width:100%;height:auto;max-height:100%;min-width:0;min-height:0;object-fit:contain}.grid{display:grid;grid-template-columns:1.2fr .8fr;gap:24px;padding-top:24px}.box{border:1px solid #ddd;padding:20px}.price{font-size:28px;font-weight:700}button{width:100%;min-height:44px;border:0;background:#333;color:#fff}</style></head><body><main class="page"><section class="hero"><div class="image"><img src="${escapeHtml(product.imageSrc)}" alt="${escapeHtml(product.name)}"></div><div><p>Everyday carry</p><h1>${escapeHtml(product.name)}</h1><p>${escapeHtml(product.description)}</p></div></section><div class="grid"><section class="box"><h2>Details</h2><ul>${features}</ul><p>SKU: RMT-001</p></section><section class="box"><p class="price">${escapeHtml(product.price)}</p><p>3 left in stock</p><button>Add to cart</button></section></div></main></body></html>`;
}

export function BeforeAfter({
	product,
	previewHtml,
}: {
	product: Product;
	previewHtml: string;
}) {
	return (
		<div className="preview-grid">
			<section>
				<h3>Before: plain storefront template</h3>
				<iframe
					sandbox=""
					title="Original product page"
					srcDoc={beforeHtml(product)}
				/>
			</section>
			<section>
				<h3>After: Codex-built campaign variant</h3>
				<iframe
					sandbox="allow-scripts"
					title="Variant product page"
					srcDoc={previewHtml || "<p>Variant preview is not ready.</p>"}
				/>
			</section>
		</div>
	);
}
