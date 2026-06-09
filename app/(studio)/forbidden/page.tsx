import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Access restricted",
};

export default function ForbiddenPage() {
	return (
		<main className="access-page" id="main-content">
			<section className="access-panel">
				<p className="section-kicker">Access</p>
				<h1>Admin proof is restricted</h1>
				<p className="muted">
					The proof view is limited to admin demo admin accounts. The studio and
					run history remain available to signed-in merchandisers.
				</p>
				<p>
					<Link className="button primary-button" href="/studio">
						Back to studio
					</Link>
				</p>
			</section>
		</main>
	);
}
