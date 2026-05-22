/** @vitest-environment jsdom */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VirtualizedTranscript } from "@/components/VirtualizedTranscript";

describe("VirtualizedTranscript", () => {
	it("renders only a window of lines for large transcripts", () => {
		const lines = Array.from({ length: 500 }, (_, index) => `line-${index}`);
		const markup = renderToStaticMarkup(
			<VirtualizedTranscript text={lines.join("\n")} />,
		);
		const rendered = (markup.match(/transcript-line/g) ?? []).length;
		expect(rendered).toBeLessThan(120);
		expect(rendered).toBeGreaterThan(0);
	});
});
