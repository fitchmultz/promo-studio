import { ProductPage } from "./ProductPage";
import { theme } from "./theme";
import "./styles.css";

export function App() {
	return (
		<div
			style={{
				background: theme.colors.background,
				color: theme.colors.text,
				fontFamily: theme.fontFamily,
			}}
		>
			<ProductPage />
		</div>
	);
}
