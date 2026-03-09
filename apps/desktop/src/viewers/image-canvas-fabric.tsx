import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Canvas, FabricImage, ActiveSelection, Point } from "fabric";
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
function DeleteIcon() { return <svg {...iconStyle}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>; }

/* ── Load image as HTMLImageElement ── */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/* ── Main Viewer ── */
function ImageCanvasFabricViewer({ data }: { data: string; theme: "dark" | "light" }) {
  const raw = String(data ?? "[]");
  const imageSrcs = useMemo<string[]>(() => {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.filter((s: string) => typeof s === "string" && s.startsWith("data:image"));
    } catch {}
    return [];
  }, [raw]);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const prevSrcsRef = useRef<string>("");

  const [bgColor, setBgColor] = useState("#1a1a2e");
  const [hasSelection, setHasSelection] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Initialize fabric canvas
  useEffect(() => {
    const el = canvasElRef.current;
    if (!el || fabricRef.current) return;

    const canvas = new Canvas(el, {
      backgroundColor: bgColor,
      selection: true,
      preserveObjectStacking: true,
    });

    // Enable zoom with Cmd/Ctrl + scroll
    canvas.on("mouse:wheel", (opt) => {
      const e = opt.e;
      if (!e.metaKey && !e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();

      const delta = e.deltaY;
      let newZoom = canvas.getZoom() * (delta > 0 ? 0.95 : 1.05);
      newZoom = Math.min(5, Math.max(0.1, newZoom));

      const point = canvas.getScenePoint(e);
      canvas.zoomToPoint(point, newZoom);
      setZoom(newZoom);
    });

    // Pan with Space + drag (or middle mouse)
    let isPanning = false;
    let lastPos = { x: 0, y: 0 };
    let spaceHeld = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        spaceHeld = true;
        canvas.defaultCursor = "grab";
        canvas.setCursor("grab");
        // Temporarily disable object selection during pan mode
        canvas.selection = false;
        canvas.forEachObject((obj) => { obj.selectable = false; });
      }
      // Delete selected
      if ((e.key === "Delete" || e.key === "Backspace") && document.activeElement?.tagName !== "INPUT") {
        const active = canvas.getActiveObjects();
        if (active.length > 0) {
          active.forEach((obj) => canvas.remove(obj));
          canvas.discardActiveObject();
          canvas.requestRenderAll();
        }
      }
      // Escape to deselect
      if (e.key === "Escape") {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }
      // Arrow keys to move selected
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        const active = canvas.getActiveObject();
        if (!active) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        if (e.key === "ArrowUp") active.top! -= step;
        if (e.key === "ArrowDown") active.top! += step;
        if (e.key === "ArrowLeft") active.left! -= step;
        if (e.key === "ArrowRight") active.left! += step;
        active.setCoords();
        canvas.requestRenderAll();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceHeld = false;
        isPanning = false;
        canvas.defaultCursor = "default";
        canvas.setCursor("default");
        canvas.selection = true;
        canvas.forEachObject((obj) => { obj.selectable = true; });
      }
    };

    canvas.on("mouse:down", (opt) => {
      if (spaceHeld) {
        isPanning = true;
        const me = opt.e as MouseEvent;
        lastPos = { x: me.clientX, y: me.clientY };
        canvas.setCursor("grabbing");
      }
    });

    canvas.on("mouse:move", (opt) => {
      if (!isPanning) return;
      const me = opt.e as MouseEvent;
      const vpt = canvas.viewportTransform!;
      vpt[4] += me.clientX - lastPos.x;
      vpt[5] += me.clientY - lastPos.y;
      lastPos = { x: me.clientX, y: me.clientY };
      canvas.requestRenderAll();
    });

    canvas.on("mouse:up", () => {
      if (isPanning) {
        isPanning = false;
        canvas.setCursor(spaceHeld ? "grab" : "default");
      }
    });

    // Track selection state
    canvas.on("selection:created", () => setHasSelection(true));
    canvas.on("selection:updated", () => setHasSelection(true));
    canvas.on("selection:cleared", () => setHasSelection(false));

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    fabricRef.current = canvas;

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      canvas.dispose();
      fabricRef.current = null;
    };
  }, []);

  // Resize canvas to fit container
  useEffect(() => {
    const el = containerRef.current;
    const canvas = fabricRef.current;
    if (!el || !canvas) return;

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        canvas.setDimensions({ width, height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Update background color
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.backgroundColor = bgColor;
    canvas.requestRenderAll();
  }, [bgColor]);

  // Add images when data changes
  useEffect(() => {
    const key = imageSrcs.join("|");
    if (key === prevSrcsRef.current || imageSrcs.length === 0) return;
    prevSrcsRef.current = key;

    const canvas = fabricRef.current;
    if (!canvas) return;

    (async () => {
      // Clear existing objects
      canvas.clear();
      canvas.backgroundColor = bgColor;

      let x = CANVAS_PADDING;
      let y = CANVAS_PADDING;
      let rowHeight = 0;
      const maxRowWidth = Math.max((canvas.width ?? 800) - CANVAS_PADDING * 2, 400);

      for (const src of imageSrcs) {
        try {
          const imgEl = await loadImage(src);
          const scale = Math.min(1, maxRowWidth / imgEl.width, 400 / imgEl.height);
          const sw = imgEl.width * scale;
          const sh = imgEl.height * scale;

          if (x + sw > maxRowWidth + CANVAS_PADDING && x > CANVAS_PADDING) {
            x = CANVAS_PADDING;
            y += rowHeight + CANVAS_PADDING;
            rowHeight = 0;
          }

          const fabricImg = new FabricImage(imgEl, {
            left: x,
            top: y,
            scaleX: scale,
            scaleY: scale,
            cornerColor: "#4d9fff",
            cornerStrokeColor: "#4d9fff",
            borderColor: "#4d9fff",
            cornerSize: 8,
            transparentCorners: false,
            cornerStyle: "circle",
          });

          canvas.add(fabricImg);

          x += sw + CANVAS_PADDING;
          rowHeight = Math.max(rowHeight, sh);
        } catch {}
      }

      canvas.requestRenderAll();

      // Zoom to fit content
      requestAnimationFrame(() => zoomToFit(canvas));
    })();
  }, [imageSrcs, bgColor]);

  // Zoom to fit all objects with padding
  const zoomToFit = useCallback((canvas: Canvas) => {
    const objects = canvas.getObjects();
    if (objects.length === 0) return;

    // Get bounding rect of all objects
    const sel = new ActiveSelection(objects, { canvas });
    const bound = sel.getBoundingRect();
    canvas.discardActiveObject();

    const cw = canvas.width ?? 800;
    const ch = canvas.height ?? 600;
    const padding = CANVAS_PADDING * 2;

    const scaleX = (cw - padding) / bound.width;
    const scaleY = (ch - padding) / bound.height;
    const newZoom = Math.min(1, scaleX, scaleY);

    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.zoomToPoint(
      new Point(cw / 2, ch / 2),
      newZoom,
    );

    // Center content
    const center = {
      x: bound.left + bound.width / 2,
      y: bound.top + bound.height / 2,
    };
    const vpt = canvas.viewportTransform!;
    vpt[4] = cw / 2 - center.x * newZoom;
    vpt[5] = ch / 2 - center.y * newZoom;
    canvas.setViewportTransform(vpt);
    setZoom(newZoom);
  }, []);

  const resetZoom = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    setZoom(1);
  }, []);

  const deleteSelected = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObjects();
    active.forEach((obj) => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }, []);

  const handleCopy = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.discardActiveObject();
    canvas.requestRenderAll();

    await new Promise((r) => setTimeout(r, 50));

    const exportCanvas = canvas.toCanvasElement(2);
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = exportCanvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    await invoke("copy_image_to_clipboard", { rgba: Array.from(imageData.data), width, height });
  }, [bgColor]);

  const handleExport = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.discardActiveObject();
    canvas.requestRenderAll();

    await new Promise((r) => setTimeout(r, 50));
    const exportCanvas = canvas.toCanvasElement(2);
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    // Draw the actual canvas background behind the content
    if (canvas.backgroundColor) {
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = canvas.backgroundColor as string;
      ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      ctx.globalCompositeOperation = "source-over";
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      exportCanvas.toBlob((b) => resolve(b), "image/png")
    );
    if (!blob) return;
    const buffer = await blob.arrayBuffer();
    await invoke("save_png_file", { pngData: Array.from(new Uint8Array(buffer)) });
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

        <div className="w-px h-3.5 bg-border-subtle mx-1" />

        {hasSelection && (
          <IconButton tooltip="Delete selected (⌫)" onClick={deleteSelected}>
            <DeleteIcon />
          </IconButton>
        )}

        <div className="flex-1" />

        {/* Zoom indicator */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={resetZoom}
              className="h-[22px] px-1.5 rounded text-[10px] font-mono text-text-muted hover:text-text hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              {Math.round(zoom * 100)}%
            </button>
          </TooltipTrigger>
          <TooltipContent>Reset zoom (⌘+scroll to zoom)</TooltipContent>
        </Tooltip>

        <div className="w-px h-3.5 bg-border-subtle mx-1" />

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

      {/* Fabric.js canvas */}
      <div ref={containerRef} className="flex-1 min-h-0 relative group/canvas">
        <canvas ref={canvasElRef} />

        {/* Shortcuts help */}
        <div className="absolute bottom-2 right-2 opacity-0 group-hover/canvas:opacity-100 transition-opacity pointer-events-none">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-[10px] text-white/70 space-y-0.5">
            <div className="flex justify-between gap-4"><span>Pan</span><span className="text-white/50">Space + Drag</span></div>
            <div className="flex justify-between gap-4"><span>Zoom</span><span className="text-white/50">⌘ + Scroll</span></div>
            <div className="flex justify-between gap-4"><span>Move</span><span className="text-white/50">Arrow Keys</span></div>
            <div className="flex justify-between gap-4"><span>Move fast</span><span className="text-white/50">⇧ + Arrow</span></div>
            <div className="flex justify-between gap-4"><span>Delete</span><span className="text-white/50">⌫</span></div>
            <div className="flex justify-between gap-4"><span>Deselect</span><span className="text-white/50">Esc</span></div>
          </div>
        </div>
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
  component: ImageCanvasFabricViewer,
});
