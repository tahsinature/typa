import { useEffect, useRef, useState } from "react";
import { copyCanvasToClipboard } from "@/lib/image-clipboard";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

type CopyStatus = "idle" | "copying" | "copied" | "failed";

const LABELS: Record<CopyStatus, string> = {
  idle: "Copy image", copying: "Copying…", copied: "Copied", failed: "Try again",
};

/** Keeps the canvas visible while native copying runs and confirms only a successful write. */
export function ImageCopyButton({ createCanvas }: { createCanvas: () => Promise<HTMLCanvasElement> }) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const [error, setError] = useState("");
  const busy = useRef(false);
  const mounted = useRef(true);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(resetTimer.current);
    };
  }, []);

  async function handleCopy() {
    if (busy.current) return;
    busy.current = true;
    clearTimeout(resetTimer.current);
    setError("");
    setStatus("copying");
    try {
      // Let the pressed/busy state paint before preparing the image.
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const canvas = await createCanvas();
      await copyCanvasToClipboard(canvas);
      if (mounted.current) {
        setStatus("copied");
        resetTimer.current = setTimeout(() => setStatus("idle"), 1800);
      }
    } catch (cause) {
      if (mounted.current) {
        setError(cause instanceof Error ? cause.message : String(cause));
        setStatus("failed");
      }
    } finally {
      busy.current = false;
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleCopy}
          disabled={status === "copying"}
          aria-busy={status === "copying"}
          aria-label={status === "failed" ? `Copy failed: ${error}. Try again` : LABELS[status]}
          className={`flex items-center justify-center gap-1.5 h-[24px] w-[104px] rounded-md text-[11px] font-medium transition-colors duration-150 motion-reduce:transition-none hover:bg-bg-hover/80 active:bg-bg-active/60 disabled:cursor-wait cursor-pointer ${status === "copied" ? "text-result" : status === "failed" ? "text-red-400" : "text-text-muted hover:text-text-secondary"}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {status === "copying" ? <circle cx="12" cy="12" r="8" strokeDasharray="36 15" className="animate-spin motion-reduce:animate-none origin-center" />
              : status === "copied" ? <path d="m5 12 4 4L19 6" />
              : status === "failed" ? <><circle cx="12" cy="12" r="9" /><path d="M12 7v6m0 4h.01" /></>
              : <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>}
          </svg>
          <span role="status" aria-live="polite">{LABELS[status]}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{status === "failed" ? `Copy failed: ${error}` : "Copy image to the system clipboard"}</TooltipContent>
    </Tooltip>
  );
}
