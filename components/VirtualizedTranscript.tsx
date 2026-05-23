"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const LINE_HEIGHT_PX = 17;
const OVERSCAN = 10;

export function VirtualizedTranscript({
	text,
	className = "transcript",
}: {
	text: string;
	className?: string;
}) {
	const lines = useMemo(() => text.split("\n"), [text]);
	const scrollerRef = useRef<HTMLDivElement>(null);
	const [viewportHeight, setViewportHeight] = useState(480);
	const [scrollTop, setScrollTop] = useState(0);

	const lineCount = lines.length;
	const totalHeight = lineCount * LINE_HEIGHT_PX;
	const firstVisible = Math.max(
		0,
		Math.floor(scrollTop / LINE_HEIGHT_PX) - OVERSCAN,
	);
	const visibleCount =
		Math.ceil(viewportHeight / LINE_HEIGHT_PX) + OVERSCAN * 2;
	const lastVisible = Math.min(lines.length, firstVisible + visibleCount);
	const offsetY = firstVisible * LINE_HEIGHT_PX;

	const onScroll = useCallback(() => {
		const el = scrollerRef.current;
		if (el) setScrollTop(el.scrollTop);
	}, []);

	useEffect(() => {
		const el = scrollerRef.current;
		if (!el) return;
		const updateViewport = () => setViewportHeight(el.clientHeight);
		updateViewport();
		const observer = new ResizeObserver(updateViewport);
		observer.observe(el);
		el.scrollTop = lineCount > 0 ? el.scrollHeight : 0;
		setScrollTop(el.scrollTop);
		return () => observer.disconnect();
	}, [lineCount]);

	return (
		<div
			ref={scrollerRef}
			className={className}
			onScroll={onScroll}
			role="log"
			aria-label="Agent transcript"
		>
			<div className="transcript-virtual-track" style={{ height: totalHeight }}>
				<div
					className="transcript-virtual-window"
					style={{ transform: `translateY(${offsetY}px)` }}
				>
					{lines.slice(firstVisible, lastVisible).map((line, index) => {
						const lineIndex = firstVisible + index;
						return (
							<div
								key={`${lineIndex}-${line.slice(0, 32)}`}
								className="transcript-line"
								style={{
									height: LINE_HEIGHT_PX,
									lineHeight: `${LINE_HEIGHT_PX}px`,
								}}
							>
								{line || "\u00a0"}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
