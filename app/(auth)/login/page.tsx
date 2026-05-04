import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/redirects";

export const dynamic = "force-dynamic";

export default async function LoginPage({
	searchParams,
}: {
	searchParams: Promise<{ error?: string; next?: string }>;
}) {
	const params = await searchParams;
	const nextPath = safeRedirectPath(params.next);
	const user = await currentUser();
	if (user) redirect(nextPath);
	return (
		<main className="login" id="main-content">
			<div className="login-hero">
				<p className="section-kicker">Demo access</p>
				<h1 className="login-hero-title">Promo Studio</h1>
				<p className="login-hero-lede">
					Sign in to create storefront variants, watch Codex work, and inspect
					validation receipts.
				</p>
				<ol className="login-hero-steps">
					<li>
						<span>1</span> Type a campaign brief
					</li>
					<li>
						<span>2</span> Codex edits the storefront workspace
					</li>
					<li>
						<span>3</span> Review previews, diffs, tests, build, and transcript
					</li>
				</ol>
			</div>
			<section className="login-panel">
				<p className="badge">Seeded credentials</p>
				<h2>Open the studio</h2>
				<p className="muted">Local demo credentials are filled in.</p>
				<form className="form" action="/api/login" method="post">
					<input name="next" type="hidden" value={nextPath} />
					<label className="field">
						Email
						<input
							name="email"
							defaultValue="demo@promostudio.test"
							autoComplete="email"
							suppressHydrationWarning
						/>
					</label>
					<label className="field">
						Password
						<input
							name="password"
							type="password"
							defaultValue="promo-studio"
							autoComplete="current-password"
							suppressHydrationWarning
						/>
					</label>
					{params.error ? (
						<p className="badge sev-1">Invalid credentials</p>
					) : null}
					<button className="button login-submit primary-button" type="submit">
						Open Promo Studio
					</button>
				</form>
			</section>
		</main>
	);
}
