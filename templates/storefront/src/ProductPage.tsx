import { CallToAction } from "./components/CallToAction";
import { HeroSection } from "./components/HeroSection";
import { ProductDetails } from "./components/ProductDetails";

export function ProductPage() {
	return (
		<main className="page">
			<HeroSection />
			<div className="content-grid">
				<ProductDetails />
				<CallToAction />
			</div>
		</main>
	);
}
