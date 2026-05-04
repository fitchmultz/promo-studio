import type { Product } from "@prisma/client";

export function primaryPromoProduct(products: Product[]) {
	return (
		products.find((product) => product.id === "ribbed-market-tote") ??
		products[0]
	);
}

export function parseFeatures(product: Pick<Product, "features">) {
	try {
		const parsed = JSON.parse(product.features) as unknown;
		return Array.isArray(parsed) ? parsed.map(String) : [];
	} catch {
		return [];
	}
}
