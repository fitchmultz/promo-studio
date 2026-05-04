import Link from "next/link";
import type { ReactNode } from "react";
import { currentUser } from "@/lib/auth";

export default async function StudioLayout({
	children,
}: {
	children: ReactNode;
}) {
	const user = await currentUser();
	return (
		<>
			<header className="studio-nav">
				<Link className="brand" href="/studio" aria-label="Promo Studio home">
					<span aria-hidden="true">PS</span>
					<strong>Promo Studio</strong>
				</Link>
				<nav aria-label="Promo Studio navigation">
					<Link href="/studio">Studio</Link>
					<Link href="/history">History</Link>
					{user?.role === "admin" ? (
						<Link className="studio-nav__proof" href="/proof">
							Proof
						</Link>
					) : null}
					{user ? (
						<form action="/api/logout" className="nav-form" method="post">
							<button type="submit">Sign out</button>
						</form>
					) : (
						<Link href="/login?next=/studio">Sign in</Link>
					)}
				</nav>
			</header>
			{children}
		</>
	);
}
