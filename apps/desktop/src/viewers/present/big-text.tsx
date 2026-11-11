import { useLayoutEffect, useRef, useState } from "react";
import { registerOutputView } from "../registry";
import { PresentEmpty } from "./empty";

const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 600;

/**
 * Uses the requested size, or finds the largest size that fits in Auto mode.
 * The size is written straight to the DOM so React never overrides a measured value.
 */
function useFitText(text: string, manualSize: number | null) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [fittedSize, setFittedSize] = useState(MIN_FONT_SIZE);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const textElement = textRef.current;
    if (!container || !textElement) return;

    if (manualSize !== null) {
      textElement.style.fontSize = `${manualSize}px`;
      return;
    }

    const fits = (size: number) => {
      textElement.style.fontSize = `${size}px`;
      return textElement.scrollWidth <= container.clientWidth && textElement.offsetHeight <= container.clientHeight;
    };

    const fit = () => {
      let low = MIN_FONT_SIZE;
      let high = MAX_FONT_SIZE + 1;
      while (high - low > 1) {
        const mid = Math.floor((low + high) / 2);
        if (fits(mid)) low = mid;
        else high = mid;
      }
      textElement.style.fontSize = `${low}px`;
      setFittedSize(low);
      container.scrollTop = 0;
      container.scrollLeft = 0;
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => observer.disconnect();
  }, [text, manualSize]);

  return { containerRef, textRef, fontSize: manualSize ?? fittedSize };
}

function BigTextContent({ text }: { text: string }) {
  const [manualSize, setManualSize] = useState<number | null>(null);
  const { containerRef, textRef, fontSize } = useFitText(text, manualSize);
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-end gap-3 border-b border-border-subtle px-3 py-1.5">
        <label className="flex min-w-0 items-center gap-3 text-[11px] text-text-muted">
          Size
          <input
            type="range"
            min={MIN_FONT_SIZE}
            max={MAX_FONT_SIZE}
            step={1}
            value={fontSize}
            onChange={(event) => setManualSize(Number(event.target.value))}
            aria-label="Big Text font size"
            aria-valuetext={`${fontSize} pixels`}
            className="w-28 min-w-0 accent-accent"
          />
        </label>
        <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-text-muted">{fontSize} px</span>
        <button
          type="button"
          title="Fit text to the panel automatically"
          aria-pressed={manualSize === null}
          onClick={() => setManualSize(null)}
          className={`h-6 shrink-0 rounded-md px-2 text-[11px] font-medium cursor-pointer focus-visible:outline-2 focus-visible:outline-accent ${
            manualSize === null ? "bg-accent/15 text-accent" : "text-text-muted hover:bg-bg-hover hover:text-text"
          }`}
        >
          Auto
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="absolute inset-8 flex flex-col overflow-auto">
          <div
            ref={textRef}
            className="my-auto w-full shrink-0 text-center font-semibold leading-tight whitespace-pre-wrap [overflow-wrap:anywhere]"
          >
            {text}
          </div>
        </div>
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
