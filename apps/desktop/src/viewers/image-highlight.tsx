import { useEffect, useRef, useState } from "react";
import { HighlightIcon } from "@/components/Icons";
import { useTabImages } from "./useTabImages";
import { registerViewer } from "./registry";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function computeDiff(
  imgA: HTMLImageElement,
  imgB: HTMLImageElement,
  threshold: number,
): { canvas: HTMLCanvasElement; diffCount: number; totalPixels: number } {
  const w = Math.max(imgA.width, imgB.width);
  const h = Math.max(imgA.height, imgB.height);

  const canvasA = document.createElement("canvas");
  canvasA.width = w;
  canvasA.height = h;
  const ctxA = canvasA.getContext("2d")!;
  ctxA.drawImage(imgA, 0, 0);
  const dataA = ctxA.getImageData(0, 0, w, h).data;

  const canvasB = document.createElement("canvas");
  canvasB.width = w;
  canvasB.height = h;
  const ctxB = canvasB.getContext("2d")!;
  ctxB.drawImage(imgB, 0, 0);
  const dataB = ctxB.getImageData(0, 0, w, h).data;

  const output = document.createElement("canvas");
  output.width = w;
  output.height = h;
  const ctxOut = output.getContext("2d")!;
  const outData = ctxOut.createImageData(w, h);

  let diffCount = 0;
  const totalPixels = w * h;

  for (let i = 0; i < dataA.length; i += 4) {
    const dr = Math.abs(dataA[i] - dataB[i]);
    const dg = Math.abs(dataA[i + 1] - dataB[i + 1]);
    const db = Math.abs(dataA[i + 2] - dataB[i + 2]);

    if (dr + dg + db > threshold) {
      // Highlight in red
      outData.data[i] = 255;
      outData.data[i + 1] = 60;
      outData.data[i + 2] = 60;
      outData.data[i + 3] = 255;
      diffCount++;
    } else {
      // Dimmed original
      outData.data[i] = dataA[i];
      outData.data[i + 1] = dataA[i + 1];
      outData.data[i + 2] = dataA[i + 2];
      outData.data[i + 3] = 80;
    }
  }

  ctxOut.putImageData(outData, 0, 0);
  return { canvas: output, diffCount, totalPixels };
}

function ImageHighlightViewer({ theme }: { data: string; theme: "dark" | "light" }) {
  const { imageA, imageB } = useTabImages();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [diffPct, setDiffPct] = useState<number | null>(null);
  const [threshold, setThreshold] = useState(30);
  const isDark = theme === "dark";

  useEffect(() => {
    if (!imageA || !imageB) return;

    let cancelled = false;
    (async () => {
      const [imgA, imgB] = await Promise.all([loadImage(imageA), loadImage(imageB)]);
      if (cancelled) return;

      const { canvas, diffCount, totalPixels } = computeDiff(imgA, imgB, threshold);
      setDiffPct(totalPixels > 0 ? (diffCount / totalPixels) * 100 : 0);

      const target = canvasRef.current;
      if (!target) return;
      target.width = canvas.width;
      target.height = canvas.height;
      const ctx = target.getContext("2d")!;
      ctx.drawImage(canvas, 0, 0);
    })();

    return () => { cancelled = true; };
  }, [imageA, imageB, threshold]);

  if (!imageA || !imageB) {
    return <div className="p-3 text-text-muted text-[13px]">Both images required</div>;
  }

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: "var(--bg)" }}>
      <div className="flex-1 flex items-center justify-center p-3 overflow-hidden">
        <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
      </div>
      <div className="flex items-center gap-3 px-4 py-2 shrink-0" style={{ borderTop: `1px solid ${isDark ? "#2d2d30" : "#e5e5ea"}` }}>
        <span className="text-[11px] text-text-muted">Threshold</span>
        <input
          type="range"
          min="1"
          max="200"
          value={threshold}
          onChange={(e) => setThreshold(parseInt(e.target.value))}
          className="flex-1 accent-accent"
        />
        <span className="text-[11px] text-text-muted tabular-nums w-[32px]">{threshold}</span>
        {diffPct !== null && (
          <span className="text-[11px] font-medium tabular-nums" style={{ color: diffPct > 5 ? "var(--cl-danger)" : "var(--cl-result)" }}>
            {diffPct.toFixed(2)}% diff
          </span>
        )}
      </div>
    </div>
  );
}

registerViewer({
  parse: (output) => output,
  id: "image-highlight",
  name: "Highlight Diff",
  icon: HighlightIcon,
  component: ImageHighlightViewer,
});
