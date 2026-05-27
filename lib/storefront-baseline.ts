import { readFile } from "node:fs/promises";
import path from "node:path";
import { paths } from "@/lib/config";
import { product } from "@/templates/storefront/src/product";
import { theme } from "@/templates/storefront/src/theme";

function escapeHtml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function escapeStyle(value: string) {
	return value.replace(/<\/style/gi, "<\\/style");
}

function renderBaselineBody() {
	const features = product.features
		.map((feature) => `<li>${escapeHtml(feature)}</li>`)
		.join("");
	return `<div style="background:${theme.colors.background};color:${theme.colors.text};font-family:${escapeHtml(theme.fontFamily)}"><main class="page"><section class="hero" aria-labelledby="product-title"><div class="product-image"><img src="${escapeHtml(product.imageSrc)}" alt="${escapeHtml(product.name)}"></div><div class="hero-copy"><p class="eyebrow">Everyday carry</p><h1 id="product-title">${escapeHtml(product.name)}</h1><p>${escapeHtml(product.description)}</p></div></section><div class="content-grid"><section class="details" aria-labelledby="details-title"><h2 id="details-title">Details</h2><ul>${features}</ul><p class="muted">Dimensions: ${escapeHtml(product.dimensions)}</p><p class="muted">SKU: ${escapeHtml(product.sku)}</p></section><section class="purchase" aria-label="Purchase panel"><p class="price">$${product.price.toFixed(2)}</p><p class="muted">${product.inventory} left in stock</p><button type="button" class="cta-button">Add to cart</button><p aria-live="polite" class="cart-feedback" role="status">Ready to add one tote.</p></section></div></main></div>`;
}

export async function renderStorefrontBaselineHtml() {
	const css = await readFile(
		path.join(paths.templateStorefront, "src", "styles.css"),
		"utf8",
	);
	return `<!doctype html><html><head><style>${escapeStyle(css)}</style></head><body><div id="root">${renderBaselineBody()}</div></body></html>`;
}
