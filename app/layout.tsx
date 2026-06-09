import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: {
		default: "Promo Studio",
		template: "%s — Promo Studio",
	},
	description:
		"Autonomous storefront variant studio powered by Codex, Pi, and Cursor agents.",
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
};

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" data-scroll-behavior="smooth">
			<body>
				<a className="skip-to-content" href="#main-content">
					Skip to main content
				</a>
				{children}
			</body>
		</html>
	);
}
