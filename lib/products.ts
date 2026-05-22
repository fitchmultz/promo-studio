import type { Product } from "@prisma/client";

export function primaryPromoProduct(products: Product[]) {
	return (
		products.find((product) => product.id === "ribbed-market-tote") ??
		products[0]
	);
}

function isStringArray(value: unknown): value is string[] {
	return (
		Array.isArray(value) && value.every((item) => typeof item === "string")
	);
}

export function parseFeatures(product: Pick<Product, "features">) {
	try {
		const parsed: unknown = JSON.parse(product.features);
		return isStringArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}
