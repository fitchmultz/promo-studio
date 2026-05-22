import { describe, expect, it } from "vitest";
import { product } from "../src/product";
import { addToCart } from "../src/cart";

describe("Commerce invariants", () => {
	it("preserves the product price", () => {
		expect(product.price).toBe(42.0);
	});

	it("preserves the SKU", () => {
		expect(product.sku).toBe("RMT-001");
	});

	it("preserves the inventory count", () => {
		expect(product.inventory).toBe(3);
	});

	it("preserves cart API behavior", () => {
		expect(addToCart(1)).toEqual({
			sku: "RMT-001",
			quantity: 1,
			unitPrice: 42,
		});
	});
});
