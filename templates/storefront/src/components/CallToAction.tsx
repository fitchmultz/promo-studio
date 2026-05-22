import { useState } from "react";
import { addToCart, checkoutEnabled } from "../cart";
import { product } from "../product";

export function CallToAction() {
	const [message, setMessage] = useState("Ready to add one tote.");
	const disabled = !checkoutEnabled();
	return (
		<section className="purchase" aria-label="Purchase panel">
			<p className="price">${product.price.toFixed(2)}</p>
			<p className="muted">{product.inventory} left in stock</p>
			<button
				type="button"
				disabled={disabled}
				onClick={() => {
					const line = addToCart(1);
					setMessage(
						`${line.quantity} ${line.sku} added at $${line.unitPrice.toFixed(2)}.`,
					);
				}}
			>
				Add to cart
			</button>
			<p aria-live="polite" className="muted">
				{message}
			</p>
		</section>
	);
}
