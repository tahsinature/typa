import { useState } from "react";
import { FadeIcon } from "@/components/Icons";
import { useTabImages } from "./useTabImages";
import { registerViewer } from "./registry";

function ImageFadeViewer({ theme }: { data: unknown; theme: "dark" | "light" }) {
  const { imageA, imageB } = useTabImages();
  const [opacity, setOpacity] = useState(0.5);
  const isDark = theme === "dark";

  if (!imageA || !imageB) {
    return <div className="p-3 text-text-muted text-[13px]">Both images required</div>;
  }

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: "var(--bg)" }}>
      <div className="flex-1 relative overflow-hidden flex items-center justify-center p-3">
        <div className="relative">
          <img src={imageA} alt="Image A" className="max-w-full max-h-full object-contain" />
          <img
            src={imageB}
            alt="Image B"
            className="absolute inset-0 max-w-full max-h-full object-contain"
            style={{ opacity }}
          />
        </div>
      </div>
      <div className="flex items-center gap-3 px-4 py-2 shrink-0" style={{ borderTop: `1px solid ${isDark ? "#2d2d30" : "#e5e5ea"}` }}>
        <span className="text-[11px] text-text-muted w-6">A</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={opacity}
          onChange={(e) => setOpacity(parseFloat(e.target.value))}
          className="flex-1 accent-accent"
        />
        <span className="text-[11px] text-text-muted w-6 text-right">B</span>
      </div>
    </div>
  );
}

registerViewer({
  id: "image-fade",
  name: "Fade View",
  icon: FadeIcon,
  component: ImageFadeViewer,
});
