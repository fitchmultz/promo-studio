import { product } from "./product";

export interface CartLine {
	sku: string;
	quantity: number;
	unitPrice: number;
}

export function addToCart(quantity = 1): CartLine {
	return {
		sku: product.sku,
		quantity,
		unitPrice: product.price,
	};
}

export function checkoutEnabled() {
	return product.inventory > 0;
}
