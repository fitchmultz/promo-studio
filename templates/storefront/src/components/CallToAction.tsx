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
				className="cta-button"
				disabled={disabled}
				onClick={() => {
					const line = addToCart(1);
					setMessage(
						`Added ${line.quantity} × ${line.sku} to cart ($${line.unitPrice.toFixed(2)} each).`,
					);
				}}
			>
				Add to cart
			</button>
			<p aria-live="polite" className="cart-feedback" role="status">
				{message}
			</p>
		</section>
	);
}
