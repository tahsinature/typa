import { useLayoutEffect, useRef } from "react";
import { registerOutputView } from "../registry";
import { PresentEmpty } from "./empty";

const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 600;

/**
 * Sets the largest font size at which the text fits inside its container.
 * The size is written straight to the DOM so React never overrides a measured value.
 */
function useFitText(text: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const textElement = textRef.current;
    if (!container || !textElement) return;

    const fits = (size: number) => {
      textElement.style.fontSize = `${size}px`;
      return textElement.scrollWidth <= container.clientWidth && textElement.offsetHeight <= container.clientHeight;
    };

    const fit = () => {
      let low = MIN_FONT_SIZE;
      let high = MAX_FONT_SIZE;
      while (high - low > 1) {
        const mid = Math.floor((low + high) / 2);
        if (fits(mid)) low = mid;
        else high = mid;
      }
      textElement.style.fontSize = `${low}px`;
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => observer.disconnect();
  }, [text]);

  return { containerRef, textRef };
}

function BigTextContent({ text }: { text: string }) {
  const { containerRef, textRef } = useFitText(text);
  return (
    <div ref={containerRef} className="absolute inset-8 overflow-hidden flex items-center">
      <div
        ref={textRef}
        className="w-full text-center font-semibold leading-tight whitespace-pre-wrap [overflow-wrap:anywhere]"
      >
        {text}
      </div>
    </div>
  );
}

function BigTextView({ data }: { data: string; theme: "dark" | "light" }) {
  const text = data.trim();
  return (
    <div className="relative h-full overflow-hidden bg-bg text-text">
      {text ? <BigTextContent text={text} /> : <PresentEmpty message="Enter text to show it big" />}
    </div>
  );
}

function BigTextIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 13L6 3l4 10M3.5 9.5h5M11 13l2.5-6 2.5 6M11.8 11h3.4" />
    </svg>
  );
}

registerOutputView({
  id: "present-big-text",
  name: "Big Text",
  icon: BigTextIcon,
  parse: (output) => output,
  component: BigTextView,
});
