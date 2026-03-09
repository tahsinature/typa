import { useEffect, useLayoutEffect, useState, useRef, useCallback, useMemo } from "react";
import { Stage, Layer, Image as KImage, Rect, Transformer } from "react-konva";
import Konva from "konva";
import { invoke } from "@tauri-apps/api/core";
import { IconButton } from "@/components/ui/icon-button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { registerViewer } from "./registry";

/* ── Types ── */
interface CanvasImage {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

const CANVAS_PADDING = 60;
const SELECTION_COLOR = "#4d9fff";
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 5;
const ZOOM_STEP = 1.1;

const BG_PRESETS = [
  { id: "dark", color: "#1a1a2e" },
  { id: "black", color: "#000000" },
  { id: "white", color: "#ffffff" },
  { id: "gray", color: "#374151" },
  { id: "blue", color: "#1e3a5f" },
  { id: "green", color: "#1a3c2a" },
];

let nextId = 1;
const uid = () => `img-${nextId++}`;

/* ── Load image helper ── */
function useLoadedImages(srcs: string[]): Map<string, HTMLImageElement> {
  const [loaded, setLoaded] = useState<Map<string, HTMLImageElement>>(new Map());
  const key = srcs.join("|");
  useEffect(() => {
    const map = new Map<string, HTMLImageElement>();
    let mounted = true;
    let count = 0;
    if (srcs.length === 0) { setLoaded(map); return; }
    for (const src of srcs) {
      const img = new window.Image();
      img.onload = () => {
        map.set(src, img);
        count++;
        if (mounted && count === srcs.length) setLoaded(new Map(map));
      };
      img.src = src;
    }
    return () => { mounted = false; };
  }, [key]);
  return loaded;
}

/* ── Compute bounding box of all images ── */
function computeCanvasBounds(images: CanvasImage[]): { width: number; height: number } {
  if (images.length === 0) return { width: 800, height: 600 };
  let maxX = 0;
  let maxY = 0;
  for (const img of images) {
    maxX = Math.max(maxX, img.x + img.width);
    maxY = Math.max(maxY, img.y + img.height);
  }
  return {
    width: maxX + CANVAS_PADDING,
    height: maxY + CANVAS_PADDING,
  };
}

/* ── Normalize: ensure padding on all sides ── */
function normalizePositions(images: CanvasImage[]): CanvasImage[] {
  if (images.length === 0) return images;
  let minX = Infinity;
  let minY = Infinity;
  for (const img of images) {
    minX = Math.min(minX, img.x);
    minY = Math.min(minY, img.y);
  }
  const shiftX = CANVAS_PADDING - minX;
  const shiftY = CANVAS_PADDING - minY;
  if (shiftX === 0 && shiftY === 0) return images;
  return images.map((img) => ({
    ...img,
    x: img.x + shiftX,
    y: img.y + shiftY,
  }));
}

/* ── Toolbar Icons ── */
const iconStyle = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function CopyIcon() { return <svg {...iconStyle}><rect x="5" y="5" width="9" height="9" rx="1.5" /><path d="M3 11H2.5A1.5 1.5 0 011 9.5v-7A1.5 1.5 0 012.5 1h7A1.5 1.5 0 0111 2.5V3" /></svg>; }
function ExportIcon() { return <svg {...iconStyle}><path d="M8 1v10M4 8l4 4 4-4M2 14h12" /></svg>; }
function DeleteIcon() { return <svg {...iconStyle}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>; }

/* ── Main Viewer ── */
function ImageCanvasViewer({ data }: { data: string; theme: "dark" | "light" }) {
  const raw = String(data ?? "[]");
  const imageSrcs = useMemo<string[]>(() => {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.filter((s: string) => typeof s === "string" && s.startsWith("data:image"));
    } catch {}
    return [];
  }, [raw]);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);

  // Hand (pan) mode refs
  const spaceHeldRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, stageX: 0, stageY: 0 });

  // Scroll compensation after normalization shifts images
  const pendingScrollRef = useRef({ x: 0, y: 0 });

  const [bgColor, setBgColor] = useState("#1a1a2e");
  const [images, setImages] = useState<CanvasImage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewSize, setViewSize] = useState({ width: 800, height: 600 });
  const [zoom, setZoom] = useState(1);

  const loadedImages = useLoadedImages(imageSrcs);

  // Canvas bounds with padding on all sides (left/top guaranteed by normalizePositions)
  const canvasBounds = useMemo(() => computeCanvasBounds(images), [images]);
  const stageWidth = Math.max(viewSize.width, canvasBounds.width);
  const stageHeight = Math.max(viewSize.height, canvasBounds.height);

  // Layout images when new ones arrive
  const prevSrcsRef = useRef<string>("");
  useEffect(() => {
    const key = imageSrcs.join("|");
    if (key === prevSrcsRef.current || imageSrcs.length === 0 || loadedImages.size !== imageSrcs.length) return;
    prevSrcsRef.current = key;

    const padding = CANVAS_PADDING;
    let x = padding;
    let y = padding;
    let rowHeight = 0;
    const maxRowWidth = Math.max(viewSize.width - padding * 2, 400);
    const newImgs: CanvasImage[] = [];

    for (const src of imageSrcs) {
      const img = loadedImages.get(src);
      if (!img) continue;
      const scale = Math.min(1, maxRowWidth / img.width, 400 / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      if (x + w > maxRowWidth + padding && newImgs.length > 0) {
        x = padding;
        y += rowHeight + padding;
        rowHeight = 0;
      }
      newImgs.push({ id: uid(), src, x, y, width: w, height: h, rotation: 0 });
      x += w + padding;
      rowHeight = Math.max(rowHeight, h);
    }
    setImages(newImgs);
  }, [imageSrcs, loadedImages, viewSize.width]);

  // Observe container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setViewSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Compensate scroll after normalization shifts (runs before paint)
  useLayoutEffect(() => {
    const { x, y } = pendingScrollRef.current;
    if (x === 0 && y === 0) return;
    const el = containerRef.current;
    if (el) {
      el.scrollLeft += x;
      el.scrollTop += y;
    }
    pendingScrollRef.current = { x: 0, y: 0 };
  }, [images]);

  // Attach transformer
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    if (!selectedId) { tr.nodes([]); tr.getLayer()?.batchDraw(); return; }
    const stage = stageRef.current;
    if (!stage) return;
    const node = stage.findOne(`#${selectedId}`);
    if (node) { tr.nodes([node]); tr.getLayer()?.batchDraw(); }
  }, [selectedId, images]);

  // Normalize images and record scroll compensation for the shift
  const setNormalizedImages = useCallback((updater: (prev: CanvasImage[]) => CanvasImage[]) => {
    setImages((prev) => {
      const updated = updater(prev);
      if (updated.length === 0) return updated;
      let minX = Infinity, minY = Infinity;
      for (const img of updated) {
        minX = Math.min(minX, img.x);
        minY = Math.min(minY, img.y);
      }
      const shiftX = CANVAS_PADDING - minX;
      const shiftY = CANVAS_PADDING - minY;
      if (shiftX > 0) pendingScrollRef.current.x += shiftX;
      if (shiftY > 0) pendingScrollRef.current.y += shiftY;
      return normalizePositions(updated);
    });
  }, []);

  const updateImage = useCallback((id: string, updates: Partial<CanvasImage>) => {
    setNormalizedImages((prev) => prev.map((img) => img.id === id ? { ...img, ...updates } : img));
  }, [setNormalizedImages]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setImages((prev) => prev.filter((img) => img.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;

      // Space → hand mode
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        spaceHeldRef.current = true;
        const stage = stageRef.current;
        if (stage) stage.container().style.cursor = "grab";
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        deleteSelected();
      }
      if (e.key === "Escape") setSelectedId(null);

      // Arrow keys to move selected image
      if (selectedId && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const delta = { x: 0, y: 0 };
        if (e.key === "ArrowUp") delta.y = -step;
        if (e.key === "ArrowDown") delta.y = step;
        if (e.key === "ArrowLeft") delta.x = -step;
        if (e.key === "ArrowRight") delta.x = step;
        setNormalizedImages((prev) => {
          const img = prev.find((i) => i.id === selectedId);
          if (!img) return prev;
          return prev.map((i) => i.id === selectedId ? { ...i, x: i.x + delta.x, y: i.y + delta.y } : i);
        });
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceHeldRef.current = false;
        isPanningRef.current = false;
        const stage = stageRef.current;
        if (stage) stage.container().style.cursor = "default";
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectedId, deleteSelected, setNormalizedImages]);

  // Deselect on empty click (skip if we just panned)
  const didPanRef = useRef(false);
  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (didPanRef.current) { didPanRef.current = false; return; }
    if (e.target === e.target.getStage()) setSelectedId(null);
  }, []);

  // Space+drag panning
  const handleStageMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!spaceHeldRef.current) return;
    isPanningRef.current = true;
    didPanRef.current = false;
    const stage = stageRef.current;
    if (stage) {
      panStartRef.current = { x: e.evt.clientX, y: e.evt.clientY, stageX: stage.x(), stageY: stage.y() };
      stage.container().style.cursor = "grabbing";
    }
  }, []);

  const handleStageMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isPanningRef.current) return;
    didPanRef.current = true;
    const stage = stageRef.current;
    if (!stage) return;
    stage.position({
      x: panStartRef.current.stageX + (e.evt.clientX - panStartRef.current.x),
      y: panStartRef.current.stageY + (e.evt.clientY - panStartRef.current.y),
    });
    stage.batchDraw();
  }, []);

  const handleStageMouseUp = useCallback(() => {
    if (!isPanningRef.current) return;
    isPanningRef.current = false;
    const stage = stageRef.current;
    if (stage) stage.container().style.cursor = spaceHeldRef.current ? "grab" : "default";
  }, []);

  // Cmd+scroll zoom toward cursor
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    const evt = e.evt;
    if (!evt.metaKey && !evt.ctrlKey) return; // plain scroll → native scroll
    evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const direction = evt.deltaY < 0 ? 1 : -1;
    const newScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, direction > 0 ? oldScale * ZOOM_STEP : oldScale / ZOOM_STEP));

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    stage.scale({ x: newScale, y: newScale });
    stage.position({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
    stage.batchDraw();
    setZoom(newScale);
  }, []);

  const resetZoom = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
    stage.batchDraw();
    setZoom(1);
  }, []);

  const handleCopy = useCallback(async () => {
    const stage = stageRef.current;
    if (!stage) return;
    setSelectedId(null);
    await new Promise((r) => setTimeout(r, 50));
    const canvas = stage.toCanvas({ x: 0, y: 0, width: canvasBounds.width, height: canvasBounds.height, pixelRatio: 2 });
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    await invoke("copy_image_to_clipboard", { rgba: Array.from(imageData.data), width, height });
  }, [canvasBounds]);

  const handleExport = useCallback(async () => {
    const stage = stageRef.current;
    if (!stage) return;
    setSelectedId(null);
    await new Promise((r) => setTimeout(r, 50));
    const dataUrl = stage.toDataURL({ x: 0, y: 0, width: canvasBounds.width, height: canvasBounds.height, pixelRatio: 2 });
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const buffer = await blob.arrayBuffer();
    await invoke("save_png_file", { pngData: Array.from(new Uint8Array(buffer)) });
  }, [canvasBounds]);

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

        {selectedId && (
          <IconButton tooltip="Delete selected (⌫)" onClick={deleteSelected}>
            <DeleteIcon />
          </IconButton>
        )}

        <div className="flex-1" />

        {/* Canvas dimensions */}
        <span className="text-[10px] font-mono text-text-faint">
          {Math.round(canvasBounds.width)} × {Math.round(canvasBounds.height)}
        </span>

        <div className="w-px h-3.5 bg-border-subtle mx-1" />

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

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 min-h-0 overflow-auto relative group/canvas">
        <Stage
          ref={stageRef}
          width={stageWidth}
          height={stageHeight}
          onClick={handleStageClick}
          onWheel={handleWheel}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
        >
          {/* Background — sized to content bounds, not full stage */}
          <Layer>
            <Rect x={0} y={0} width={canvasBounds.width} height={canvasBounds.height} fill={bgColor} listening={false} />
          </Layer>

          {/* Images */}
          <Layer>
            {images.map((img) => {
              const el = loadedImages.get(img.src);
              if (!el) return null;
              return (
                <KImage
                  key={img.id}
                  id={img.id}
                  image={el}
                  x={img.x}
                  y={img.y}
                  width={img.width}
                  height={img.height}
                  rotation={img.rotation}
                  draggable
                  onClick={() => { if (!spaceHeldRef.current) setSelectedId(img.id); }}
                  onTap={() => { if (!spaceHeldRef.current) setSelectedId(img.id); }}
                  onDragStart={(e) => { if (spaceHeldRef.current) e.target.stopDrag(); }}
                  onDragEnd={(e) => updateImage(img.id, { x: e.target.x(), y: e.target.y() })}
                  onTransformEnd={(e) => {
                    const node = e.target;
                    updateImage(img.id, {
                      x: node.x(),
                      y: node.y(),
                      width: Math.max(20, node.width() * node.scaleX()),
                      height: Math.max(20, node.height() * node.scaleY()),
                      rotation: node.rotation(),
                    });
                    node.scaleX(1);
                    node.scaleY(1);
                  }}
                />
              );
            })}
            <Transformer
              ref={trRef}
              rotateEnabled={true}
              borderStroke={SELECTION_COLOR}
              anchorStroke={SELECTION_COLOR}
              anchorFill="#fff"
              anchorSize={8}
              anchorCornerRadius={2}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 20 || newBox.height < 20) return oldBox;
                return newBox;
              }}
            />
          </Layer>
        </Stage>

        {/* Shortcuts help — bottom-right, fades in on hover */}
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
  component: ImageCanvasViewer,
});
