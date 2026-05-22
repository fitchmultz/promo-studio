import { product } from "../product";

export function HeroSection() {
	return (
		<section className="hero" aria-labelledby="product-title">
			<div className="product-image">
				<img src={product.imageSrc} alt={product.name} />
			</div>
			<div className="hero-copy">
				<p className="eyebrow">Everyday carry</p>
				<h1 id="product-title">{product.name}</h1>
				<p>{product.description}</p>
			</div>
		</section>
	);
}
