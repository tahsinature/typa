import { useState, useRef, useCallback, useEffect } from "react";
import { Excalidraw, MainMenu, exportToBlob, exportToCanvas, hashElementsVersion } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import { saveImageFile } from "@/lib/image-file";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ImageCopyButton } from "@/components/ImageCopyButton";
import { OpenWithButton } from "@/components/OpenWithButton";
import { ImageExportButton } from "@/components/ImageExportButton";
import { exportScale } from "@/lib/image-clipboard";
import { useImageSizeReport } from "@/lib/use-image-size-report";
import { registerOutputView } from "./registry";

/* -- Constants -- */
const CANVAS_PADDING = 60;

function scaledDimensions(width: number, height: number) {
  const scale = exportScale(width, height);
  return { width: Math.round(width * scale), height: Math.round(height * scale), scale };
}

const BG_PRESETS = [
  { id: "dark", color: "#1a1a2e" },
  { id: "black", color: "#000000" },
  { id: "white", color: "#ffffff" },
  { id: "gray", color: "#374151" },
  { id: "blue", color: "#1e3a5f" },
  { id: "green", color: "#1a3c2a" },
  { id: "transparent", color: "transparent" },
];

/* -- Main Viewer -- */
function ImageCanvasExcalidrawViewer(_props: { data: string; theme: "dark" | "light" }) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [bgColor, setBgColor] = useState("transparent");
  const [sceneVersion, setSceneVersion] = useState(0);

  const createCopyCanvas = useCallback(async () => {
    const api = apiRef.current;
    if (!api) throw new Error("The canvas is still loading");
    const elements = api.getSceneElements().filter((element) => !element.isDeleted);
    if (!elements.length) throw new Error("Add something to the canvas first");
    return exportToCanvas({
      elements,
      files: api.getFiles(),
      appState: { viewBackgroundColor: bgColor, exportBackground: bgColor !== "transparent" },
      exportPadding: CANVAS_PADDING,
      getDimensions: scaledDimensions,
    });
  }, [bgColor]);

  const createPng = useCallback(async () => {
    const api = apiRef.current;
    if (!api) throw new Error("The canvas is still loading");
    const elements = api.getSceneElements().filter((element) => !element.isDeleted);
    if (!elements.length) throw new Error("Add something to the canvas first");
    return exportToBlob({
      elements,
      files: api.getFiles(),
      appState: { viewBackgroundColor: bgColor, exportBackground: bgColor !== "transparent" },
      mimeType: "image/png",
      exportPadding: CANVAS_PADDING,
      getDimensions: scaledDimensions,
    });
  }, [bgColor]);

  useImageSizeReport(createPng, sceneVersion);

  const handleExport = useCallback(async () => {
    try {
      await saveImageFile(await createPng(), "Canvas");
    } catch (error) {
      console.error("Export failed:", error);
    }
  }, [createPng]);

  // Update background color when preset changes
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    api.updateScene({
      appState: { viewBackgroundColor: bgColor },
    });
  }, [bgColor]);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-bg">
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

        <ImageCopyButton createCanvas={createCopyCanvas} />
        <OpenWithButton createPng={createPng} baseName="Canvas" />
        <ImageExportButton onExport={handleExport} />
      </div>

      {/* Excalidraw canvas */}
      <style>{`
        .excalidraw .layer-ui__wrapper__footer-right,
        .excalidraw .layer-ui__wrapper__top-right { display: none !important; }
      `}</style>
      <div className="flex-1 min-h-0 relative">
        <Excalidraw
          excalidrawAPI={(api) => { apiRef.current = api; }}
          onChange={(elements) => setSceneVersion(hashElementsVersion(elements))}
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
