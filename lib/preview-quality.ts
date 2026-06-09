const MIN_USEFUL_PREVIEW_CHARS = 500;

export function isUsablePreviewHtml(previewHtml: string | null | undefined) {
	const html = previewHtml?.trim() ?? "";
	if (html.length < MIN_USEFUL_PREVIEW_CHARS) return false;
	return /<html[\s>]/i.test(html) && /<body[\s>]/i.test(html);
}
