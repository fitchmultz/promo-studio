import Image from "next/image";
import { VariantForm } from "@/components/VariantForm";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseFeatures, primaryPromoProduct } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
	const user = await requireUser();
	const products = await prisma.product.findMany({
		orderBy: [{ name: "asc" }],
	});
	const product = primaryPromoProduct(products);
	if (!product) {
		return (
			<main className="studio-page">
				<p>No product is seeded. Run npm run setup.</p>
			</main>
		);
	}
	return (
		<main className="studio-page" id="main-content">
			<section className="studio-hero">
				<p className="section-kicker">Autonomous commerce code agent</p>
				<h1>Turn a campaign brief into a tested product page variant.</h1>
				<p>
					Signed in as {user.name}. Codex edits an isolated storefront
					workspace, streams activity, runs validation, and saves the artifact.
				</p>
			</section>
			<div className="studio-grid">
				<section
					className="studio-card product-card"
					aria-labelledby="product-card-title"
				>
					<p className="section-kicker">Product</p>
					<h2 id="product-card-title">{product.name}</h2>
					<div className="product-art">
						<Image
							src={product.imageSrc}
							alt={product.name}
							fill
							priority
							sizes="(max-width: 900px) 100vw, 420px"
						/>
					</div>
					<p>{product.description}</p>
					<strong>{product.price}</strong>
					<ul>
						{parseFeatures(product).map((feature) => (
							<li key={feature}>{feature}</li>
						))}
					</ul>
					<p className="muted">
						The product source image is shown here. The storefront template
						starts intentionally plain so the after state is obvious.
					</p>
				</section>
				<VariantForm productId={product.id} />
			</div>
		</main>
	);
}
