import { product } from "../product";

export function ProductDetails() {
	return (
		<section className="details" aria-labelledby="details-title">
			<h2 id="details-title">Details</h2>
			<ul>
				{product.features.map((feature) => (
					<li key={feature}>{feature}</li>
				))}
			</ul>
			<p className="muted">Dimensions: {product.dimensions}</p>
			<p className="muted">SKU: {product.sku}</p>
		</section>
	);
}
