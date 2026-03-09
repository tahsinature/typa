import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  Tldraw,
  Editor,
  createShapeId,
  AssetRecordType,
  TLComponents,
  TLUiOverrides,
} from "tldraw";
import "tldraw/tldraw.css";
import { invoke } from "@tauri-apps/api/core";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { IconButton } from "@/components/ui/icon-button";
import { registerViewer } from "./registry";

/* ── Constants ── */
const CANVAS_PADDING = 60;

const BG_PRESETS = [
  { id: "dark", color: "#1a1a2e" },
  { id: "black", color: "#000000" },
  { id: "white", color: "#ffffff" },
  { id: "gray", color: "#374151" },
  { id: "blue", color: "#1e3a5f" },
  { id: "green", color: "#1a3c2a" },
];

/* ── Toolbar Icons ── */
const iconStyle = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function CopyIcon() { return <svg {...iconStyle}><rect x="5" y="5" width="9" height="9" rx="1.5" /><path d="M3 11H2.5A1.5 1.5 0 011 9.5v-7A1.5 1.5 0 012.5 1h7A1.5 1.5 0 0111 2.5V3" /></svg>; }
function ExportIcon() { return <svg {...iconStyle}><path d="M8 1v10M4 8l4 4 4-4M2 14h12" /></svg>; }

/* ── Hide all tldraw UI — we only want the canvas ── */
const components: TLComponents = {
  Toolbar: null,
  PageMenu: null,
  MainMenu: null,
  StylePanel: null,
  NavigationPanel: null,
  HelpMenu: null,
  DebugMenu: null,
  DebugPanel: null,
  MenuPanel: null,
  TopPanel: null,
  SharePanel: null,
  ActionsMenu: null,
  QuickActions: null,
};

/* ── Disable all shape tools — only select/hand ── */
const overrides: TLUiOverrides = {
  tools(_editor, tools) {
    const { select, hand } = tools;
    return { select, hand };
  },
};

/* ── Load a data URL image and return its dimensions ── */
function getImageSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 400, h: 300 });
    img.src = src;
  });
}

/* ── Main Viewer ── */
function ImageCanvasTldrawViewer({ data }: { data: string; theme: "dark" | "light" }) {
  const raw = String(data ?? "[]");
  const imageSrcs = useMemo<string[]>(() => {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.filter((s: string) => typeof s === "string" && s.startsWith("data:image"));
    } catch {}
    return [];
  }, [raw]);

  const editorRef = useRef<Editor | null>(null);
  const prevSrcsRef = useRef<string>("");
  const [bgColor, setBgColor] = useState("#1a1a2e");

  // Sync images into tldraw when data changes
  useEffect(() => {
    const key = imageSrcs.join("|");
    if (key === prevSrcsRef.current || imageSrcs.length === 0) return;
    prevSrcsRef.current = key;

    const editor = editorRef.current;
    if (!editor) return;

    addImagesToEditor(editor, imageSrcs);
  }, [imageSrcs]);

  const addImagesToEditor = useCallback(async (editor: Editor, srcs: string[]) => {
    // Clear existing shapes
    const allShapeIds = editor.getCurrentPageShapeIds();
    if (allShapeIds.size > 0) {
      editor.deleteShapes([...allShapeIds]);
    }

    let x = CANVAS_PADDING;
    let y = CANVAS_PADDING;
    let rowHeight = 0;
    const maxRowWidth = 800;

    for (const src of srcs) {
      const { w, h } = await getImageSize(src);
      const scale = Math.min(1, maxRowWidth / w, 400 / h);
      const sw = w * scale;
      const sh = h * scale;

      if (x + sw > maxRowWidth + CANVAS_PADDING && x > CANVAS_PADDING) {
        x = CANVAS_PADDING;
        y += rowHeight + CANVAS_PADDING;
        rowHeight = 0;
      }

      const assetId = AssetRecordType.createId();
      editor.createAssets([{
        id: assetId,
        type: "image",
        typeName: "asset",
        props: {
          name: "image",
          src,
          w,
          h,
          mimeType: src.startsWith("data:image/png") ? "image/png" : "image/jpeg",
          isAnimated: false,
        },
        meta: {},
      }]);

      const shapeId = createShapeId();
      editor.createShape({
        id: shapeId,
        type: "image",
        x,
        y,
        props: {
          assetId,
          w: sw,
          h: sh,
        },
      });

      x += sw + CANVAS_PADDING;
      rowHeight = Math.max(rowHeight, sh);
    }

    // Zoom to fit all content
    requestAnimationFrame(() => {
      editor.zoomToFit({ animation: { duration: 200 } });
    });
  }, []);

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;

    // Set dark mode based on theme
    editor.user.updateUserPreferences({ colorScheme: "dark" });

    // If images are already loaded, add them
    if (imageSrcs.length > 0) {
      addImagesToEditor(editor, imageSrcs);
    }
  }, [imageSrcs, addImagesToEditor]);

  const handleCopy = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;

    // Select all shapes for export
    const allIds = [...editor.getCurrentPageShapeIds()];
    if (allIds.length === 0) return;

    // Use tldraw's built-in export
    const svg = await editor.getSvgString(allIds, { background: true, padding: CANVAS_PADDING });
    if (!svg) return;

    // Convert SVG to canvas for clipboard
    const img = new window.Image();
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth * 2;
      canvas.height = img.naturalHeight * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      await invoke("copy_image_to_clipboard", {
        rgba: Array.from(imageData.data),
        width: canvas.width,
        height: canvas.height,
      });
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.svg)}`;
  }, []);

  const handleExport = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;

    const allIds = [...editor.getCurrentPageShapeIds()];
    if (allIds.length === 0) return;

    const svg = await editor.getSvgString(allIds, { background: true, padding: CANVAS_PADDING });
    if (!svg) return;

    // Convert SVG to PNG
    const img = new window.Image();
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth * 2;
      canvas.height = img.naturalHeight * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const buffer = await blob.arrayBuffer();
        await invoke("save_png_file", { pngData: Array.from(new Uint8Array(buffer)) });
      }, "image/png");
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.svg)}`;
  }, []);

  if (imageSrcs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-bg">
        <span className="text-text-faint text-[13px]">Drop images in the input to start</span>
      </div>
    );
  }

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
                    background: p.color,
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

      {/* tldraw canvas */}
      <div
        className="flex-1 min-h-0 relative"
        style={{ "--tl-color-background": bgColor } as React.CSSProperties}
      >
        <Tldraw
          onMount={handleMount}
          components={components}
          overrides={overrides}
          inferDarkMode={false}
          options={{ maxPages: 1 }}
        />
      </div>
    </div>
  );
}

/* ── Icon ── */
function CanvasIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

registerViewer({
  parse: (output) => output,
  id: "image-canvas",
  name: "Image Canvas",
  icon: CanvasIcon,
  component: ImageCanvasTldrawViewer,
});
