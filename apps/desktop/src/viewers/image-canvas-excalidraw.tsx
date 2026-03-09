import { useState, useRef, useCallback, useEffect } from "react";
import { Excalidraw, MainMenu, exportToBlob } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import { invoke } from "@tauri-apps/api/core";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { IconButton } from "@/components/ui/icon-button";
import { registerOutputView } from "./registry";

/* -- Constants -- */
const CANVAS_PADDING = 60;

const BG_PRESETS = [
  { id: "dark", color: "#1a1a2e" },
  { id: "black", color: "#000000" },
  { id: "white", color: "#ffffff" },
  { id: "gray", color: "#374151" },
  { id: "blue", color: "#1e3a5f" },
  { id: "green", color: "#1a3c2a" },
  { id: "transparent", color: "transparent" },
];

/* -- Toolbar Icons -- */
const iconStyle = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function CopyIcon() { return <svg {...iconStyle}><rect x="5" y="5" width="9" height="9" rx="1.5" /><path d="M3 11H2.5A1.5 1.5 0 011 9.5v-7A1.5 1.5 0 012.5 1h7A1.5 1.5 0 0111 2.5V3" /></svg>; }
function ExportIcon() { return <svg {...iconStyle}><path d="M8 1v10M4 8l4 4 4-4M2 14h12" /></svg>; }

/* -- Main Viewer -- */
function ImageCanvasExcalidrawViewer(_props: { data: string; theme: "dark" | "light" }) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [bgColor, setBgColor] = useState("#1a1a2e");

  const containerRef = useRef<HTMLDivElement>(null);

  const handleCopy = useCallback(() => {
    // Dispatch Shift+Option+C to trigger Excalidraw's built-in "Copy to clipboard as PNG"
    const target = containerRef.current?.querySelector(".excalidraw") ?? document.activeElement;
    if (!target) return;
    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "C",
        code: "KeyC",
        shiftKey: true,
        altKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
  }, []);

  const handleExport = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;

    const elements = api.getSceneElements().filter((el) => !el.isDeleted);
    if (elements.length === 0) return;

    const blob = await exportToBlob({
      elements,
      files: api.getFiles(),
      appState: { viewBackgroundColor: bgColor },
      mimeType: "image/png",
      exportPadding: CANVAS_PADDING,
      getDimensions: (w: number, h: number) => ({ width: w * 2, height: h * 2, scale: 2 }),
    });

    const buffer = await blob.arrayBuffer();
    await invoke("save_png_file", { pngData: Array.from(new Uint8Array(buffer)) });
  }, [bgColor]);

  // Update background color when preset changes
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    api.updateScene({
      appState: { viewBackgroundColor: bgColor },
    });
  }, [bgColor]);

  return (
    <div ref={containerRef} className="h-full flex flex-col overflow-hidden bg-bg">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 h-[36px] shrink-0 border-b border-border-subtle">
        {/* Background presets */}
        <div className="flex items-center gap-0.5">
          {BG_PRESETS.map((p) => (
            <Tooltip key={p.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setBgColor(p.color)}
                  className="w-[16px] h-[16px] rounded-full border-[1.5px] transition-all cursor-pointer"
                  style={{
                    background: p.color === "transparent"
                      ? "conic-gradient(#555 25%, #888 25% 50%, #555 50% 75%, #888 75%)"
                      : p.color,
                    backgroundSize: p.color === "transparent" ? "8px 8px" : undefined,
                    borderColor: bgColor === p.color ? "var(--cl-accent)" : "transparent",
                    transform: bgColor === p.color ? "scale(1.2)" : "scale(1)",
                  }}
                />
              </TooltipTrigger>
              <TooltipContent>{p.id}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        <div className="flex-1" />

        <IconButton tooltip="Copy to clipboard" onClick={handleCopy}><CopyIcon /></IconButton>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleExport}
              className="h-[24px] px-2.5 rounded-md text-[11px] font-medium text-white bg-accent hover:bg-accent-hover transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <ExportIcon />
              Export
            </button>
          </TooltipTrigger>
          <TooltipContent>Download as PNG</TooltipContent>
        </Tooltip>
      </div>

      {/* Excalidraw canvas */}
      <style>{`
        .excalidraw .layer-ui__wrapper__footer-right,
        .excalidraw .layer-ui__wrapper__top-right { display: none !important; }
      `}</style>
      <div className="flex-1 min-h-0 relative">
        <Excalidraw
          excalidrawAPI={(api) => { apiRef.current = api; }}
          initialData={{
            appState: {
              viewBackgroundColor: bgColor,
              theme: "light",
            },
          }}
          UIOptions={{
            canvasActions: {
              saveToActiveFile: false,
              loadScene: false,
              export: false,
              toggleTheme: false,
            },
            welcomeScreen: false,
          }}
        >
          <MainMenu>
            <MainMenu.DefaultItems.ClearCanvas />
            <MainMenu.DefaultItems.ChangeCanvasBackground />
          </MainMenu>
        </Excalidraw>
      </div>
    </div>
  );
}

/* -- Icon -- */
function CanvasIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

registerOutputView({
  id: "image-canvas",
  name: "Image Canvas",
  parse: (output) => output,
  icon: CanvasIcon,
  component: ImageCanvasExcalidrawViewer,
});
