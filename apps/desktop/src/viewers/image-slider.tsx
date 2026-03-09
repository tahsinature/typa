import { useState, useRef, useCallback } from "react";
import { SliderIcon } from "@/components/Icons";
import { useTabImages } from "./useTabImages";
import { registerViewer } from "./registry";

function ImageSliderViewer({ theme }: { data: string; theme: "dark" | "light" }) {
  const { imageA, imageB } = useTabImages();
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handleMove = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setPosition((x / rect.width) * 100);
  }, []);

  const handleMouseDown = useCallback(() => {
    dragging.current = true;
    const onMove = (e: MouseEvent) => {
      if (dragging.current) handleMove(e.clientX);
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [handleMove]);

  if (!imageA || !imageB) {
    return <div className="p-3 text-text-muted text-[13px]">Both images required</div>;
  }

  const accent = "var(--cl-accent)";

  return (
    <div
      ref={containerRef}
      className="h-full relative overflow-hidden cursor-col-resize select-none"
      style={{ backgroundColor: "var(--bg)" }}
      onMouseDown={(e) => {
        handleMove(e.clientX);
        handleMouseDown();
      }}
    >
      {/* Image B (full, underneath) */}
      <img src={imageB} alt="Image B" className="absolute inset-0 w-full h-full object-contain p-3" />

      {/* Image A (clipped) */}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        <img src={imageA} alt="Image A" className="absolute inset-0 w-full h-full object-contain p-3" />
      </div>

      {/* Slider line */}
      <div
        className="absolute top-0 bottom-0 w-[2px]"
        style={{ left: `${position}%`, backgroundColor: accent, transform: "translateX(-1px)" }}
      >
        {/* Handle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[28px] h-[28px] rounded-full flex items-center justify-center"
          style={{ backgroundColor: accent, left: "1px" }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
            <path d="M3 3L1 6l2 3M9 3l2 3-2 3" strokeWidth="1.5" stroke="white" fill="none" />
          </svg>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-2 left-3 text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(0,0,0,0.5)", color: "white" }}>A</div>
      <div className="absolute top-2 right-3 text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(0,0,0,0.5)", color: "white" }}>B</div>
    </div>
  );
}

registerViewer({
  parse: (output) => output,
  id: "image-slider",
  name: "Slider View",
  icon: SliderIcon,
  component: ImageSliderViewer,
});
