import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import exifr from "exifr";
import { ImageIcon } from "@/components/Icons";
import { IconButton } from "@/components/ui/icon-button";
import { registerOutputView } from "./registry";
import { AddPopover } from "./image-inspector-add-popover";
import { analyzeImage, type ImageAnalysis, type RGB } from "./image-inspector-analysis";

/* ── Types ── */

interface LoadedImage {
  id: string;
  src: string;
  el: HTMLImageElement;
  name: string;
  format: string;
  sizeBytes: number;
  width: number;
  height: number;
  /** Position within the parent Canvas (canvas-local coords). */
  localX: number;
  localY: number;
}

interface Canvas {
  id: string;
  images: LoadedImage[];
}

interface ViewTransform {
  zoom: number;
  panX: number;
  panY: number;
}

interface PixelInfo {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

interface ExifPayload {
  make?: string;
  model?: string;
  lens?: string;
  fNumber?: number;
  exposureTime?: number;
  iso?: number;
  focalLength?: number;
  focalLengthIn35mm?: number;
  dateTimeOriginal?: Date;
  software?: string;
  latitude?: number;
  longitude?: number;
  colorSpace?: string | number;
  bitsPerSample?: number;
  orientation?: number;
}

/* ── Constants ── */

const ZOOM_MIN = 0.02;
const ZOOM_MAX = 64;
const ZOOM_STEP = 1.15;
const LOUPE_SIZE = 140;
const LOUPE_FACTOR = 8;
const FIT_PADDING = 24;
const IMAGE_GAP = 24;
const CLICK_THRESHOLD = 5; // px — max movement between mousedown/mouseup that still counts as a click

let nextSeq = 1;
const uid = () => `img-${nextSeq++}`;
const cid = () => `cvs-${nextSeq++}`;

/* ── Utils ── */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function aspectRatio(w: number, h: number): string {
  const g = gcd(w, h);
  return `${w / g}:${h / g}`;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function dataUrlByteSize(dataUrl: string): number {
  const i = dataUrl.indexOf(",");
  if (i < 0) return 0;
  return Math.ceil(((dataUrl.length - i - 1) * 3) / 4);
}

function formatFromMime(mime: string): string {
  return mime.replace(/^image\//, "").toUpperCase() || "IMG";
}

function formatExposure(seconds: number): string {
  if (seconds >= 1) return `${seconds.toFixed(1)}s`;
  return `1/${Math.round(1 / seconds)}s`;
}
function formatFNumber(f: number): string {
  return `f/${f % 1 === 0 ? f.toFixed(0) : f.toFixed(1)}`;
}
function formatFocal(mm: number): string {
  return `${Math.round(mm)} mm`;
}
function formatDate(d: Date): string {
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
function formatColorSpace(cs: string | number): string {
  if (typeof cs === "string") return cs;
  if (cs === 1) return "sRGB";
  if (cs === 65535) return "Uncalibrated";
  return String(cs);
}
function formatCoord(v: number, axis: "lat" | "lon"): string {
  const dir = axis === "lat" ? (v >= 0 ? "N" : "S") : (v >= 0 ? "E" : "W");
  return `${Math.abs(v).toFixed(5)}° ${dir}`;
}

async function blobToLoadedImage(blob: Blob, name: string): Promise<LoadedImage> {
  const src = await blobToDataUrl(blob);
  const el = await loadImage(src);
  return {
    id: uid(),
    src,
    el,
    name,
    format: formatFromMime(blob.type),
    sizeBytes: blob.size || dataUrlByteSize(src),
    width: el.naturalWidth,
    height: el.naturalHeight,
    localX: 0,
    localY: 0,
  };
}

async function fileToLoadedImage(file: File): Promise<LoadedImage> {
  return blobToLoadedImage(file, file.name || "Pasted image");
}

/* ── Canvas geometry ── */

function canvasBounds(canvas: Canvas): { width: number; height: number } {
  let w = 0;
  let h = 0;
  for (const img of canvas.images) {
    w = Math.max(w, img.localX + img.width);
    h = Math.max(h, img.localY + img.height);
  }
  return { width: w, height: h };
}

function imageAtLocalPoint(canvas: Canvas, localX: number, localY: number): LoadedImage | null {
  // Walk in reverse so later-added images win when overlapping (defensive — our layout doesn't overlap).
  for (let i = canvas.images.length - 1; i >= 0; i--) {
    const img = canvas.images[i];
    if (
      localX >= img.localX &&
      localX < img.localX + img.width &&
      localY >= img.localY &&
      localY < img.localY + img.height
    ) {
      return img;
    }
  }
  return null;
}

/** Layout new images to the right of existing ones with IMAGE_GAP between, starting at localY=0. */
function layoutAppended(existing: LoadedImage[], incoming: LoadedImage[]): LoadedImage[] {
  let nextX = 0;
  for (const img of existing) {
    nextX = Math.max(nextX, img.localX + img.width);
  }
  if (existing.length > 0) nextX += IMAGE_GAP;
  const positioned: LoadedImage[] = [];
  for (const img of incoming) {
    positioned.push({ ...img, localX: nextX, localY: 0 });
    nextX += img.width + IMAGE_GAP;
  }
  return positioned;
}

/** Re-flow images horizontally so any gap from a removal is closed. */
function relayout(images: LoadedImage[]): LoadedImage[] {
  let x = 0;
  return images.map((img) => {
    const next = { ...img, localX: x, localY: 0 };
    x += img.width + IMAGE_GAP;
    return next;
  });
}

/* ── Icons ── */

const iconBase = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const FitIcon = () => (
  <svg {...iconBase}>
    <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />
  </svg>
);
const OneToOneIcon = () => (
  <svg {...iconBase}>
    <text x="3" y="17" fontSize="11" fill="currentColor" stroke="none" fontFamily="ui-monospace,monospace" fontWeight="600">1:1</text>
  </svg>
);
const MinusIcon = () => (
  <svg {...iconBase}><path d="M5 12h14" /></svg>
);
const ZoomInIcon = () => (
  <svg {...iconBase}><path d="M12 5v14M5 12h14" /></svg>
);
const EyedropperIcon = () => (
  <svg {...iconBase}>
    <path d="M11 19l-3 1 1-3L18.5 7.5a1.77 1.77 0 012.5 2.5L11 19z" />
    <path d="M15 5l4 4" />
  </svg>
);
const LoupeIcon = () => (
  <svg {...iconBase}>
    <circle cx="10" cy="10" r="6" />
    <path d="M14.5 14.5L20 20" />
    <path d="M10 7v6M7 10h6" />
  </svg>
);
const TrashIcon = () => (
  <svg {...iconBase}>
    <path d="M4 7h16M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13" />
  </svg>
);
const InfoOutlineIcon = () => (
  <svg {...iconBase}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8.5v.01" />
  </svg>
);
const InspectorTabIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="M16 16l5 5" />
  </svg>
);
const TargetIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
  </svg>
);
const LayersIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3 13l9 5 9-5" />
    <path d="M3 18l9 5 9-5" />
  </svg>
);
const LockIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 018 0v3" />
  </svg>
);

/* ── Sub: Thumbnail strip ── */

function ThumbnailTile({
  canvas,
  active,
  onSelect,
  onRemove,
  onDropFiles,
}: {
  canvas: Canvas;
  active: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onDropFiles: (canvasId: string, files: File[]) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const first = canvas.images[0];
  return (
    <div
      className="relative group cursor-pointer rounded-md overflow-hidden border-2 transition-colors"
      style={{
        borderColor: dragOver
          ? "var(--cl-accent)"
          : active
          ? "var(--cl-accent)"
          : "transparent",
        aspectRatio: "1",
      }}
      onClick={() => onSelect(canvas.id)}
      onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
      onDragLeave={(e) => { e.stopPropagation(); setDragOver(false); }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) onDropFiles(canvas.id, files);
      }}
      title={`${canvas.images.length} image${canvas.images.length === 1 ? "" : "s"} — drop here to add to this canvas`}
    >
      {first && (
        <img
          src={first.src}
          alt={first.name}
          className="w-full h-full object-cover"
          style={{ imageRendering: "auto" }}
        />
      )}
      {dragOver && (
        <div className="absolute inset-0 bg-accent/20 pointer-events-none" />
      )}
      {canvas.images.length > 1 && (
        <div className="absolute bottom-0.5 left-0.5 px-1 rounded bg-black/70 text-white text-[9px] font-mono leading-[14px]">
          ×{canvas.images.length}
        </div>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(canvas.id); }}
        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 text-white text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Remove canvas"
      >
        ×
      </button>
    </div>
  );
}

function ThumbnailStrip({
  canvases,
  activeId,
  onSelect,
  onRemove,
  onDropToCanvas,
  addSlot,
}: {
  canvases: Canvas[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onDropToCanvas: (canvasId: string, files: File[]) => void;
  addSlot: React.ReactNode;
}) {
  if (canvases.length === 0) return null;
  return (
    <div className="shrink-0 w-[68px] border-r border-border-subtle/60 overflow-y-auto py-2 px-2 flex flex-col gap-2 bg-bg-surface/40">
      {canvases.map((c) => (
        <ThumbnailTile
          key={c.id}
          canvas={c}
          active={c.id === activeId}
          onSelect={onSelect}
          onRemove={onRemove}
          onDropFiles={onDropToCanvas}
        />
      ))}
      {addSlot}
    </div>
  );
}

/* ── Sub: Empty state ── */

function EmptyDropZone({
  onPick,
  dragOver,
}: {
  onPick: () => void;
  dragOver: boolean;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div
        className="flex flex-col items-center justify-center gap-3 w-full h-full rounded-xl border-2 border-dashed transition-colors"
        style={{
          borderColor: dragOver ? "var(--cl-accent)" : "rgba(255,255,255,0.08)",
          background: dragOver ? "rgba(0,122,255,0.04)" : "transparent",
        }}
      >
        <div className="text-text-faint"><ImageIcon /></div>
        <div className="text-[12px] text-text-muted">
          Drop images, paste, or{" "}
          <button onClick={onPick} className="text-accent hover:underline cursor-pointer">browse</button>
        </div>
        <div className="text-[10px] text-text-faint">Then zoom in (⌘ + scroll) to inspect pixel detail</div>
      </div>
    </div>
  );
}

/* ── Sub: Image info popover ── */

function InfoSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-2.5 border-b border-border-subtle/50 last:border-0">
      <div className="text-[9.5px] font-semibold tracking-[0.08em] uppercase text-text-faint mb-1.5 select-none">{label}</div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 text-[11px]">
      <span className="text-text-faint shrink-0 w-[88px]">{label}</span>
      <span className="text-text-secondary font-mono break-all select-text">{value}</span>
    </div>
  );
}

function CopyButton({ value, label, className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const onClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }, [value]);
  return (
    <button
      onClick={onClick}
      className={`shrink-0 inline-flex items-center justify-center h-5 px-1.5 rounded text-[9.5px] font-medium uppercase tracking-[0.06em] transition-colors ${
        copied ? "text-accent bg-accent/10" : "text-text-faint hover:text-text-secondary hover:bg-bg-hover"
      } ${className ?? ""}`}
      aria-label="Copy"
    >
      {copied ? "Copied" : (label ?? "Copy")}
    </button>
  );
}

function ColorSwatch({ color, size = 24 }: { color: RGB; size?: number }) {
  const hex = rgbToHex(color.r, color.g, color.b);
  const [copied, setCopied] = useState(false);
  const onClick = useCallback(() => {
    navigator.clipboard.writeText(hex).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }, [hex]);
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-1 outline-none"
      title={`Copy ${hex}`}
    >
      <span
        className="block rounded-md border border-white/10 shadow-sm transition-transform group-hover:scale-105"
        style={{ width: size, height: size, backgroundColor: `rgb(${color.r},${color.g},${color.b})` }}
      />
      <span className={`text-[9px] font-mono leading-tight ${copied ? "text-accent" : "text-text-faint group-hover:text-text-muted"}`}>
        {copied ? "Copied" : hex}
      </span>
    </button>
  );
}

function HistogramSvg({ data, width = 280, height = 48 }: { data: { r: number[]; g: number[]; b: number[] }; width?: number; height?: number }) {
  const max = Math.max(
    ...data.r, ...data.g, ...data.b, 1,
  );
  const path = (counts: number[]) => {
    let d = `M 0 ${height}`;
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * width;
      const y = height - (counts[i] / max) * height;
      d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    d += ` L ${width} ${height} Z`;
    return d;
  };
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
      <rect width={width} height={height} fill="rgba(255,255,255,0.03)" rx={3} />
      <path d={path(data.r)} fill="rgba(248,81,73,0.45)" />
      <path d={path(data.g)} fill="rgba(74,222,128,0.45)" />
      <path d={path(data.b)} fill="rgba(77,159,255,0.45)" />
    </svg>
  );
}

function SnippetRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-[10.5px]">
      <span className="shrink-0 w-[62px] text-text-faint uppercase tracking-[0.06em] text-[9px]">{label}</span>
      <code className="flex-1 min-w-0 px-2 py-1 rounded bg-bg-input text-text-secondary truncate font-mono text-[10px]" title={value}>
        {value}
      </code>
      <CopyButton value={value} />
    </div>
  );
}

function ImageInfoPopover({
  image,
  exif,
  exifLoaded,
  headerNote,
  getAnalysis,
}: {
  image: LoadedImage;
  exif: ExifPayload | null | undefined;
  exifLoaded: boolean;
  /** Context label shown in the popover header, e.g. "Hovered" or "First image". */
  headerNote: string;
  getAnalysis: (img: LoadedImage) => ImageAnalysis | null;
}) {
  const megapixels = ((image.width * image.height) / 1_000_000).toFixed(2);
  const analysis = useMemo(() => getAnalysis(image), [image, getAnalysis]);

  const hasCamera = exif && (exif.make || exif.model || exif.lens);
  const hasExposure = exif && (exif.fNumber || exif.exposureTime || exif.iso || exif.focalLength);
  const hasGps = exif && exif.latitude != null && exif.longitude != null;
  const hasColor = exif && (exif.colorSpace || exif.bitsPerSample);
  const hasTimestamp = exif && exif.dateTimeOriginal;
  const hasSoftware = exif && exif.software;

  // Snippets (truncated for display; full string is copied via CopyButton)
  const safeName = image.name.replace(/[\]\\]/g, "_");
  const mdSnippet = `![${safeName}](${image.src})`;
  const htmlSnippet = `<img src="${image.src}" alt="${safeName}" width="${image.width}" height="${image.height}" />`;
  const cssSnippet = `background-image: url("${image.src}"); width: ${image.width}px; height: ${image.height}px; background-size: cover;`;

  return (
    <div className="text-text-secondary">
      <div className="px-3 py-2.5 border-b border-border-subtle/50 bg-bg-surface/40">
        <div className="text-[9.5px] font-semibold tracking-[0.08em] uppercase text-text-faint select-none">{headerNote}</div>
        <div className="text-[12px] text-text-secondary mt-0.5 truncate" title={image.name}>{image.name}</div>
      </div>

      <InfoSection label="File">
        <InfoRow label="Name" value={image.name} />
        <InfoRow label="Format" value={image.format} />
        <InfoRow label="Size" value={formatBytes(image.sizeBytes)} />
      </InfoSection>

      <InfoSection label="Dimensions">
        <InfoRow label="Width" value={`${image.width} px`} />
        <InfoRow label="Height" value={`${image.height} px`} />
        <InfoRow label="Aspect" value={aspectRatio(image.width, image.height)} />
        <InfoRow label="Megapixels" value={`${megapixels} MP`} />
        {analysis?.hasAlpha && (
          <InfoRow
            label="Alpha"
            value={`${(analysis.alphaFraction * 100).toFixed(1)}% transparent`}
          />
        )}
      </InfoSection>

      {analysis && analysis.palette.length > 0 && (
        <InfoSection label="Palette">
          <div className="grid grid-cols-6 gap-2 mt-0.5">
            {analysis.palette.map((c, i) => (
              <ColorSwatch key={i} color={c} />
            ))}
          </div>
        </InfoSection>
      )}

      {analysis && (
        <InfoSection label="Tone">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-text-faint text-[11px] w-[88px]">Average</span>
            <ColorSwatch color={analysis.average} size={18} />
          </div>
          <div className="flex flex-col gap-1">
            <HistogramSvg data={analysis.histogram} />
            <div className="flex items-center gap-3 text-[9px] font-mono text-text-faint">
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: "rgba(248,81,73,0.6)" }} />R</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: "rgba(74,222,128,0.6)" }} />G</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: "rgba(77,159,255,0.6)" }} />B</span>
            </div>
          </div>
        </InfoSection>
      )}

      {hasCamera && (
        <InfoSection label="Camera">
          {(exif.make || exif.model) && (
            <InfoRow label="Body" value={[exif.make, exif.model].filter(Boolean).join(" ")} />
          )}
          {exif.lens && <InfoRow label="Lens" value={exif.lens} />}
        </InfoSection>
      )}

      {hasExposure && (
        <InfoSection label="Exposure">
          {exif.fNumber != null && <InfoRow label="Aperture" value={formatFNumber(exif.fNumber)} />}
          {exif.exposureTime != null && <InfoRow label="Shutter" value={formatExposure(exif.exposureTime)} />}
          {exif.iso != null && <InfoRow label="ISO" value={exif.iso} />}
          {exif.focalLength != null && (
            <InfoRow
              label="Focal length"
              value={
                exif.focalLengthIn35mm != null && exif.focalLengthIn35mm !== exif.focalLength
                  ? `${formatFocal(exif.focalLength)} (${formatFocal(exif.focalLengthIn35mm)} eq.)`
                  : formatFocal(exif.focalLength)
              }
            />
          )}
        </InfoSection>
      )}

      {hasTimestamp && (
        <InfoSection label="Captured">
          <InfoRow label="Date" value={formatDate(exif.dateTimeOriginal as Date)} />
        </InfoSection>
      )}

      {hasGps && (
        <InfoSection label="Location">
          <InfoRow label="Latitude" value={formatCoord(exif.latitude as number, "lat")} />
          <InfoRow label="Longitude" value={formatCoord(exif.longitude as number, "lon")} />
          <a
            href={`https://maps.apple.com/?ll=${exif.latitude},${exif.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-accent hover:underline mt-1"
          >
            Open in Maps →
          </a>
        </InfoSection>
      )}

      {hasColor && (
        <InfoSection label="Color">
          {exif.colorSpace != null && <InfoRow label="Color space" value={formatColorSpace(exif.colorSpace)} />}
          {exif.bitsPerSample != null && <InfoRow label="Bit depth" value={`${exif.bitsPerSample}-bit`} />}
        </InfoSection>
      )}

      {hasSoftware && (
        <InfoSection label="Software">
          <InfoRow label="Editor" value={exif.software as string} />
        </InfoSection>
      )}

      <div className="px-3 py-2.5 border-b border-border-subtle/50 last:border-0">
        <div className="flex items-center justify-between mb-1.5 select-none">
          <span className="text-[9.5px] font-semibold tracking-[0.08em] uppercase text-text-faint">Snippets</span>
          <CopyButton value={image.src} label="Copy data URL" />
        </div>
        <div className="flex flex-col gap-1.5">
          <SnippetRow label="Markdown" value={mdSnippet} />
          <SnippetRow label="HTML" value={htmlSnippet} />
          <SnippetRow label="CSS" value={cssSnippet} />
        </div>
      </div>

      {exifLoaded && !exif && (
        <div className="px-3 py-2 text-[10.5px] text-text-faint italic select-none border-t border-border-subtle/50">
          No EXIF metadata.
        </div>
      )}
      {!exifLoaded && (
        <div className="px-3 py-2 text-[10.5px] text-text-faint italic select-none border-t border-border-subtle/50">
          Loading EXIF…
        </div>
      )}
    </div>
  );
}

/* ── Sub: Eyedropper HUD ── */

function EyedropperHUD({
  cursor,
  pixel,
  stageSize,
}: {
  cursor: { x: number; y: number };
  pixel: PixelInfo;
  stageSize: { width: number; height: number };
}) {
  const hex = rgbToHex(pixel.r, pixel.g, pixel.b);
  const rgbStr = `rgb(${pixel.r}, ${pixel.g}, ${pixel.b})`;
  const offset = 16;
  const chipW = 180;
  const chipH = 56;
  const flipX = cursor.x + offset + chipW > stageSize.width;
  const flipY = cursor.y + offset + chipH > stageSize.height;
  const left = flipX ? cursor.x - offset - chipW : cursor.x + offset;
  const top = flipY ? cursor.y - offset - chipH : cursor.y + offset;
  return (
    <div
      className="absolute pointer-events-none rounded-md bg-black/75 text-white px-2.5 py-1.5 flex items-center gap-2 shadow-lg"
      style={{ left, top, width: chipW }}
    >
      <span
        key={hex}
        className="inline-block w-7 h-7 rounded border border-white/15 shrink-0"
        style={{ backgroundColor: rgbStr }}
      />
      <div className="flex flex-col text-[10.5px] font-mono leading-tight">
        <span>{hex}</span>
        <span className="text-white/60">{rgbStr}</span>
        <span className="text-white/40">x:{pixel.x} y:{pixel.y}</span>
      </div>
    </div>
  );
}

/* ── Sub: Loupe overlay ── */

function Loupe({
  cursor,
  image,
  imgX,
  imgY,
  stageSize,
}: {
  cursor: { x: number; y: number };
  image: LoadedImage;
  /** Cursor's image-local x (pixel coord within `image`). */
  imgX: number;
  /** Cursor's image-local y (pixel coord within `image`). */
  imgY: number;
  stageSize: { width: number; height: number };
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = LOUPE_SIZE * dpr;
    canvas.height = LOUPE_SIZE * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
    ctx.save();
    ctx.beginPath();
    ctx.arc(LOUPE_SIZE / 2, LOUPE_SIZE / 2, LOUPE_SIZE / 2 - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    const span = LOUPE_SIZE / LOUPE_FACTOR;
    const sx = imgX - span / 2;
    const sy = imgY - span / 2;
    ctx.drawImage(image.el, sx, sy, span, span, 0, 0, LOUPE_SIZE, LOUPE_SIZE);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(LOUPE_SIZE / 2 - 6, LOUPE_SIZE / 2);
    ctx.lineTo(LOUPE_SIZE / 2 + 6, LOUPE_SIZE / 2);
    ctx.moveTo(LOUPE_SIZE / 2, LOUPE_SIZE / 2 - 6);
    ctx.lineTo(LOUPE_SIZE / 2, LOUPE_SIZE / 2 + 6);
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(LOUPE_SIZE / 2, LOUPE_SIZE / 2, LOUPE_SIZE / 2 - 1, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [imgX, imgY, image]);

  const offset = 24;
  const flipX = cursor.x + offset + LOUPE_SIZE > stageSize.width;
  const flipY = cursor.y + offset + LOUPE_SIZE > stageSize.height;
  const left = flipX ? cursor.x - offset - LOUPE_SIZE : cursor.x + offset;
  const top = flipY ? cursor.y - offset - LOUPE_SIZE : cursor.y + offset;

  return (
    <canvas
      ref={ref}
      className="absolute pointer-events-none rounded-full shadow-xl"
      style={{ left, top, width: LOUPE_SIZE, height: LOUPE_SIZE }}
    />
  );
}

/* ── Main Viewer ── */

function ImageInspectorViewer(_props: { data: string; theme: "dark" | "light" }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stageObserverRef = useRef<ResizeObserver | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Offscreen canvases for pixel reads, keyed by image id.
  const offscreenCacheRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  // Analysis cache keyed by image id; computed lazily when the popover opens.
  const analysisCacheRef = useRef<Map<string, ImageAnalysis | null>>(new Map());
  // EXIF cache keyed by image id; null = no EXIF found.
  const [exifByImage, setExifByImage] = useState<Map<string, ExifPayload | null>>(new Map());

  const [canvases, setCanvases] = useState<Canvas[]>([]);
  const [activeCanvasId, setActiveCanvasId] = useState<string | null>(null);
  const [hoveredImageId, setHoveredImageId] = useState<string | null>(null);
  /** Sticky inspection target. Set by clicking an image; cleared by clicking empty space, Escape, or canvas switch. */
  const [lockedImageId, setLockedImageId] = useState<string | null>(null);
  const [view, setView] = useState<ViewTransform>({ zoom: 1, panX: 0, panY: 0 });
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [dragOverStage, setDragOverStage] = useState(false);

  const [eyedropperOn, setEyedropperOn] = useState(false);
  const [loupeOn, setLoupeOn] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [pixel, setPixel] = useState<PixelInfo | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const panStateRef = useRef<{
    active: boolean;
    spaceHeld: boolean;
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
    /** Set true once cursor moves >CLICK_THRESHOLD between mousedown and mouseup. */
    dragged: boolean;
  }>({ active: false, spaceHeld: false, startClientX: 0, startClientY: 0, startPanX: 0, startPanY: 0, dragged: false });

  const activeCanvas = useMemo(
    () => canvases.find((c) => c.id === activeCanvasId) ?? null,
    [canvases, activeCanvasId],
  );

  // Image to surface in footer / info popover. Priority: locked > hovered > first.
  const focusedImage = useMemo(() => {
    if (!activeCanvas) return null;
    if (lockedImageId) {
      const hit = activeCanvas.images.find((i) => i.id === lockedImageId);
      if (hit) return hit;
    }
    if (hoveredImageId) {
      const hit = activeCanvas.images.find((i) => i.id === hoveredImageId);
      if (hit) return hit;
    }
    return activeCanvas.images[0] ?? null;
  }, [activeCanvas, lockedImageId, hoveredImageId]);

  // Clear lock when the active canvas changes (lock doesn't carry across canvases).
  useEffect(() => {
    setLockedImageId(null);
  }, [activeCanvasId]);

  const activeBounds = useMemo(
    () => activeCanvas ? canvasBounds(activeCanvas) : { width: 0, height: 0 },
    [activeCanvas],
  );

  // Convenience derivations used by both event handlers and the JSX.
  const hoveredImage = useMemo(
    () => activeCanvas?.images.find((i) => i.id === hoveredImageId) ?? null,
    [activeCanvas, hoveredImageId],
  );
  const lockedImage = useMemo(
    () => activeCanvas?.images.find((i) => i.id === lockedImageId) ?? null,
    [activeCanvas, lockedImageId],
  );

  /* ── Image management ── */

  const addFilesAsNewCanvas = useCallback(async (files: File[]) => {
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    const loaded = await Promise.all(imageFiles.map(fileToLoadedImage));
    const positioned = layoutAppended([], loaded);
    const newCanvas: Canvas = { id: cid(), images: positioned };
    setCanvases((prev) => [...prev, newCanvas]);
    setActiveCanvasId(newCanvas.id);
  }, []);

  const addBlobAsNewCanvas = useCallback(async (blob: Blob, name?: string) => {
    if (!blob.type.startsWith("image/")) return;
    const img = await blobToLoadedImage(blob, name ?? "Clipboard image");
    const positioned = layoutAppended([], [img]);
    const newCanvas: Canvas = { id: cid(), images: positioned };
    setCanvases((prev) => [...prev, newCanvas]);
    setActiveCanvasId(newCanvas.id);
  }, []);

  const addUrlAsNewCanvas = useCallback(async (url: string): Promise<{ error?: string }> => {
    try {
      const res = await fetch(url);
      if (!res.ok) return { error: `HTTP ${res.status}` };
      const blob = await res.blob();
      if (!blob.type.startsWith("image/")) return { error: "URL did not return an image" };
      const name = url.split("/").pop()?.split("?")[0] || "image";
      await addBlobAsNewCanvas(blob, name);
      return {};
    } catch {
      return { error: "Fetch failed (possibly CORS)" };
    }
  }, [addBlobAsNewCanvas]);

  const addFilesToActiveCanvas = useCallback(async (files: File[]) => {
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    if (!activeCanvasId) {
      await addFilesAsNewCanvas(files);
      return;
    }
    const loaded = await Promise.all(imageFiles.map(fileToLoadedImage));
    setCanvases((prev) => prev.map((c) => {
      if (c.id !== activeCanvasId) return c;
      const positioned = layoutAppended(c.images, loaded);
      return { ...c, images: [...c.images, ...positioned] };
    }));
  }, [activeCanvasId, addFilesAsNewCanvas]);

  const addFilesToCanvas = useCallback(async (canvasId: string, files: File[]) => {
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    const loaded = await Promise.all(imageFiles.map(fileToLoadedImage));
    setCanvases((prev) => prev.map((c) => {
      if (c.id !== canvasId) return c;
      const positioned = layoutAppended(c.images, loaded);
      return { ...c, images: [...c.images, ...positioned] };
    }));
    setActiveCanvasId(canvasId);
  }, []);

  const getAnalysis = useCallback((img: LoadedImage): ImageAnalysis | null => {
    const cache = analysisCacheRef.current;
    if (cache.has(img.id)) return cache.get(img.id) ?? null;
    const result = analyzeImage(img.el);
    cache.set(img.id, result);
    return result;
  }, []);

  const flashToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((prev) => (prev === msg ? null : prev)), 1400);
  }, []);

  const removeCanvas = useCallback((id: string) => {
    const target = canvases.find((c) => c.id === id);
    if (target) {
      for (const img of target.images) {
        offscreenCacheRef.current.delete(img.id);
        analysisCacheRef.current.delete(img.id);
      }
      setExifByImage((prev) => {
        let next: Map<string, ExifPayload | null> | null = null;
        for (const img of target.images) {
          if (prev.has(img.id)) {
            if (!next) next = new Map(prev);
            next.delete(img.id);
          }
        }
        return next ?? prev;
      });
      flashToast(`Removed canvas (${target.images.length} image${target.images.length === 1 ? "" : "s"})`);
    }
    setCanvases((prev) => prev.filter((c) => c.id !== id));
    if (id === activeCanvasId) {
      const remaining = canvases.filter((c) => c.id !== id);
      setActiveCanvasId(remaining.length > 0 ? remaining[0].id : null);
    }
  }, [canvases, activeCanvasId, flashToast]);

  const removeImageFromCanvas = useCallback((canvasId: string, imageId: string) => {
    const c = canvases.find((c) => c.id === canvasId);
    const img = c?.images.find((i) => i.id === imageId);
    if (!c || !img) return;

    // Single-image canvas: defer to canvas removal so caches and active id are handled together.
    if (c.images.length <= 1) {
      removeCanvas(canvasId);
      return;
    }

    offscreenCacheRef.current.delete(imageId);
    analysisCacheRef.current.delete(imageId);
    setExifByImage((prev) => {
      if (!prev.has(imageId)) return prev;
      const next = new Map(prev);
      next.delete(imageId);
      return next;
    });
    if (lockedImageId === imageId) setLockedImageId(null);
    if (hoveredImageId === imageId) setHoveredImageId(null);

    setCanvases((prev) =>
      prev.map((c) => {
        if (c.id !== canvasId) return c;
        return { ...c, images: relayout(c.images.filter((i) => i.id !== imageId)) };
      }),
    );

    flashToast(`Removed ${img.name}`);
  }, [canvases, lockedImageId, hoveredImageId, removeCanvas, flashToast]);

  /* ── EXIF: lazy fetch when popover opens for the focused image ── */

  useEffect(() => {
    if (!infoOpen || !focusedImage) return;
    if (exifByImage.has(focusedImage.id)) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await exifr.parse(focusedImage.src, { gps: true });
        if (cancelled) return;
        setExifByImage((prev) => {
          const next = new Map(prev);
          next.set(focusedImage.id, (data as ExifPayload | undefined) ?? null);
          return next;
        });
      } catch {
        if (cancelled) return;
        setExifByImage((prev) => {
          const next = new Map(prev);
          next.set(focusedImage.id, null);
          return next;
        });
      }
    })();
    return () => { cancelled = true; };
  }, [infoOpen, focusedImage, exifByImage]);

  /* ── View transform helpers ── */

  const fitCanvas = useCallback((bounds: { width: number; height: number }, stage: { width: number; height: number }) => {
    if (stage.width === 0 || stage.height === 0 || bounds.width === 0 || bounds.height === 0) {
      return { zoom: 1, panX: 0, panY: 0 };
    }
    const availW = Math.max(stage.width - FIT_PADDING * 2, 100);
    const availH = Math.max(stage.height - FIT_PADDING * 2, 100);
    const zoom = Math.min(availW / bounds.width, availH / bounds.height, 1);
    const panX = (stage.width - bounds.width * zoom) / 2;
    const panY = (stage.height - bounds.height * zoom) / 2;
    return { zoom, panX, panY };
  }, []);

  const fit = useCallback(() => {
    if (!activeCanvas) return;
    setView(fitCanvas(activeBounds, stageSize));
  }, [activeCanvas, activeBounds, stageSize, fitCanvas]);

  const oneToOne = useCallback(() => {
    if (!activeCanvas || stageSize.width === 0) return;
    setView({
      zoom: 1,
      panX: (stageSize.width - activeBounds.width) / 2,
      panY: (stageSize.height - activeBounds.height) / 2,
    });
  }, [activeCanvas, activeBounds, stageSize]);

  const zoomBy = useCallback((factor: number, anchor?: { x: number; y: number }) => {
    setView((prev) => {
      const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prev.zoom * factor));
      if (next === prev.zoom) return prev;
      const ax = anchor?.x ?? stageSize.width / 2;
      const ay = anchor?.y ?? stageSize.height / 2;
      const cx = (ax - prev.panX) / prev.zoom;
      const cy = (ay - prev.panY) / prev.zoom;
      return { zoom: next, panX: ax - cx * next, panY: ay - cy * next };
    });
  }, [stageSize]);

  // Auto-fit when the active canvas changes.
  const lastFitForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeCanvas || stageSize.width === 0 || stageSize.height === 0) return;
    if (lastFitForRef.current === activeCanvas.id) return;
    lastFitForRef.current = activeCanvas.id;
    setView(fitCanvas(activeBounds, stageSize));
  }, [activeCanvas, activeBounds, stageSize, fitCanvas]);

  /* ── Stage callback ref ── */

  const setStageEl = useCallback((el: HTMLDivElement | null) => {
    stageRef.current = el;
    if (stageObserverRef.current) {
      stageObserverRef.current.disconnect();
      stageObserverRef.current = null;
    }
    if (!el) {
      setStageSize({ width: 0, height: 0 });
      return;
    }
    const rect = el.getBoundingClientRect();
    setStageSize({ width: rect.width, height: rect.height });
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setStageSize({ width: r.width, height: r.height });
    });
    ro.observe(el);
    stageObserverRef.current = ro;
  }, []);

  useEffect(() => () => {
    if (stageObserverRef.current) {
      stageObserverRef.current.disconnect();
      stageObserverRef.current = null;
    }
  }, []);

  /* ── Draw the active canvas's images ── */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = stageSize.width * dpr;
    canvas.height = stageSize.height * dpr;
    canvas.style.width = `${stageSize.width}px`;
    canvas.style.height = `${stageSize.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, stageSize.width, stageSize.height);

    if (!activeCanvas) return;
    ctx.imageSmoothingEnabled = view.zoom < 1;
    ctx.imageSmoothingQuality = "high";

    for (const img of activeCanvas.images) {
      const x = view.panX + img.localX * view.zoom;
      const y = view.panY + img.localY * view.zoom;
      ctx.drawImage(img.el, x, y, img.width * view.zoom, img.height * view.zoom);
    }
  }, [activeCanvas, view, stageSize]);

  /* ── Offscreen + pixel reads ── */

  const getOffscreen = useCallback((img: LoadedImage): HTMLCanvasElement => {
    const cache = offscreenCacheRef.current;
    const cached = cache.get(img.id);
    if (cached) return cached;
    const off = document.createElement("canvas");
    off.width = img.width;
    off.height = img.height;
    const octx = off.getContext("2d", { willReadFrequently: true });
    if (octx) octx.drawImage(img.el, 0, 0);
    cache.set(img.id, off);
    return off;
  }, []);

  const readImagePixel = useCallback(
    (img: LoadedImage, imgX: number, imgY: number): PixelInfo | null => {
      if (imgX < 0 || imgY < 0 || imgX >= img.width || imgY >= img.height) return null;
      const off = getOffscreen(img);
      const octx = off.getContext("2d");
      if (!octx) return null;
      const data = octx.getImageData(imgX, imgY, 1, 1).data;
      return { x: imgX, y: imgY, r: data[0], g: data[1], b: data[2], a: data[3] };
    },
    [getOffscreen],
  );

  /* ── Pointer interactions ── */

  const stageRelative = (clientX: number, clientY: number) => {
    const el = stageRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const stageToCanvasLocal = useCallback((stageX: number, stageY: number) => ({
    localX: (stageX - view.panX) / view.zoom,
    localY: (stageY - view.panY) / view.zoom,
  }), [view]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    e.preventDefault();
    const { x, y } = stageRelative(e.clientX, e.clientY);
    const direction = e.deltaY < 0 ? 1 : -1;
    zoomBy(direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP, { x, y });
  }, [zoomBy]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!activeCanvas) return;
    if (eyedropperOn && !panStateRef.current.spaceHeld) {
      const rel = stageRelative(e.clientX, e.clientY);
      const { localX, localY } = stageToCanvasLocal(rel.x, rel.y);
      const img = imageAtLocalPoint(activeCanvas, localX, localY);
      if (img) {
        const px = readImagePixel(img, Math.floor(localX - img.localX), Math.floor(localY - img.localY));
        if (px) {
          const hex = rgbToHex(px.r, px.g, px.b);
          navigator.clipboard.writeText(hex).catch(() => {});
          setToast(`Copied ${hex}`);
          window.setTimeout(() => setToast(null), 1200);
        }
      }
      return;
    }
    panStateRef.current.active = true;
    panStateRef.current.dragged = false;
    panStateRef.current.startClientX = e.clientX;
    panStateRef.current.startClientY = e.clientY;
    panStateRef.current.startPanX = view.panX;
    panStateRef.current.startPanY = view.panY;
  }, [activeCanvas, eyedropperOn, view, stageToCanvasLocal, readImagePixel]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rel = stageRelative(e.clientX, e.clientY);
    setCursor(rel);

    if (panStateRef.current.active) {
      const dx = e.clientX - panStateRef.current.startClientX;
      const dy = e.clientY - panStateRef.current.startClientY;
      if (Math.abs(dx) > CLICK_THRESHOLD || Math.abs(dy) > CLICK_THRESHOLD) {
        panStateRef.current.dragged = true;
      }
      setView((prev) => ({
        ...prev,
        panX: panStateRef.current.startPanX + dx,
        panY: panStateRef.current.startPanY + dy,
      }));
      return;
    }

    if (!activeCanvas) return;
    const { localX, localY } = stageToCanvasLocal(rel.x, rel.y);
    const img = imageAtLocalPoint(activeCanvas, localX, localY);

    setHoveredImageId(img ? img.id : null);

    if ((eyedropperOn || loupeOn) && img) {
      const px = readImagePixel(img, Math.floor(localX - img.localX), Math.floor(localY - img.localY));
      setPixel(px);
    } else {
      setPixel(null);
    }
  }, [activeCanvas, eyedropperOn, loupeOn, stageToCanvasLocal, readImagePixel]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const wasClick = panStateRef.current.active && !panStateRef.current.dragged;
    panStateRef.current.active = false;
    panStateRef.current.dragged = false;

    // Treat as click-to-lock only in default mode (not eyedropper).
    if (!wasClick || eyedropperOn || !activeCanvas) return;
    const rel = stageRelative(e.clientX, e.clientY);
    const { localX, localY } = stageToCanvasLocal(rel.x, rel.y);
    const img = imageAtLocalPoint(activeCanvas, localX, localY);
    setLockedImageId((prev) => {
      if (!img) return null;             // click in gap → clear lock
      return prev === img.id ? null : img.id; // toggle if same; switch if different
    });
  }, [activeCanvas, eyedropperOn, stageToCanvasLocal]);

  const handleMouseLeave = useCallback(() => {
    panStateRef.current.active = false;
    setCursor(null);
    setPixel(null);
    setHoveredImageId(null);
  }, []);

  /* ── Paste / drop ── */

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const files: File[] = [];
      for (const item of e.clipboardData.items) {
        if (item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        addFilesToActiveCanvas(files);
      }
    };
    el.addEventListener("paste", onPaste);
    return () => el.removeEventListener("paste", onPaste);
  }, [addFilesToActiveCanvas]);

  const handleStageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverStage(false);
    addFilesToActiveCanvas(Array.from(e.dataTransfer.files));
  }, [addFilesToActiveCanvas]);

  /* ── Canvas navigation ── */

  const goByDelta = useCallback((delta: number) => {
    if (canvases.length < 2 || !activeCanvasId) return;
    const idx = canvases.findIndex((c) => c.id === activeCanvasId);
    if (idx === -1) return;
    const next = ((idx + delta) % canvases.length + canvases.length) % canvases.length;
    setActiveCanvasId(canvases[next].id);
  }, [canvases, activeCanvasId]);

  const goToEnd = useCallback((which: "first" | "last") => {
    if (canvases.length === 0) return;
    setActiveCanvasId(canvases[which === "first" ? 0 : canvases.length - 1].id);
  }, [canvases]);

  /* ── Keyboard shortcuts ── */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.code === "Space" && !e.repeat) {
        panStateRef.current.spaceHeld = true;
      }
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "0") { e.preventDefault(); fit(); }
        else if (e.key === "1") { e.preventDefault(); oneToOne(); }
        else if (e.key === "=" || e.key === "+") { e.preventDefault(); zoomBy(ZOOM_STEP); }
        else if (e.key === "-") { e.preventDefault(); zoomBy(1 / ZOOM_STEP); }
        return;
      }
      if (e.key === "e" || e.key === "E") { setEyedropperOn((v) => !v); }
      else if (e.key === "l" || e.key === "L") { setLoupeOn((v) => !v); }
      else if (e.key === "d" || e.key === "D") { if (focusedImage) setInfoOpen((v) => !v); }
      else if (e.key === "ArrowLeft" || e.key === "[") { e.preventDefault(); goByDelta(-1); }
      else if (e.key === "ArrowRight" || e.key === "]") { e.preventDefault(); goByDelta(1); }
      else if (e.key === "Home") { e.preventDefault(); goToEnd("first"); }
      else if (e.key === "End") { e.preventDefault(); goToEnd("last"); }
      else if (e.key === "Escape") { setLockedImageId(null); }
      else if (e.key === "Delete" || e.key === "Backspace") {
        if (!activeCanvasId || !activeCanvas) return;
        e.preventDefault();
        // Shift+⌫ always removes the entire canvas.
        if (e.shiftKey) {
          removeCanvas(activeCanvasId);
          return;
        }
        const multi = activeCanvas.images.length > 1;
        if (!multi) {
          removeCanvas(activeCanvasId);
          return;
        }
        const target = lockedImage ?? hoveredImage;
        if (target) {
          removeImageFromCanvas(activeCanvasId, target.id);
        } else {
          flashToast("Click an image to lock it first, or ⇧⌫ to remove the canvas");
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") panStateRef.current.spaceHeld = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [activeCanvasId, activeCanvas, fit, oneToOne, zoomBy, removeCanvas, removeImageFromCanvas, goByDelta, goToEnd, focusedImage, lockedImage, hoveredImage, flashToast]);

  const cursorStyle = eyedropperOn
    ? "crosshair"
    : panStateRef.current.active
    ? "grabbing"
    : "grab";

  // Loupe image-local coords (computed only when hovered image exists)
  const loupeImgX = hoveredImage && cursor ? (cursor.x - view.panX) / view.zoom - hoveredImage.localX : 0;
  const loupeImgY = hoveredImage && cursor ? (cursor.y - view.panY) / view.zoom - hoveredImage.localY : 0;

  const hiddenFileInputRef = useRef<HTMLInputElement>(null);
  const [dragOverPlus, setDragOverPlus] = useState(false);

  /* ── Render ── */

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="h-full flex flex-col outline-none"
      style={{ backgroundColor: "var(--bg)" }}
    >
      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-1 px-2 h-[36px] border-b border-border-subtle">
        <IconButton tooltip="Fit to view" shortcut="⌘0" onClick={fit} disabled={!activeCanvas}><FitIcon /></IconButton>
        <IconButton tooltip="Actual size (1:1)" shortcut="⌘1" onClick={oneToOne} disabled={!activeCanvas}><OneToOneIcon /></IconButton>
        <IconButton tooltip="Zoom out" shortcut="⌘-" onClick={() => zoomBy(1 / ZOOM_STEP)} disabled={!activeCanvas}><MinusIcon /></IconButton>
        <IconButton tooltip="Zoom in" shortcut="⌘+" onClick={() => zoomBy(ZOOM_STEP)} disabled={!activeCanvas}><ZoomInIcon /></IconButton>
        <span className="text-[10px] font-mono text-text-muted px-1 select-none min-w-[44px] text-center">
          {Math.round(view.zoom * 100)}%
        </span>

        <div className="w-px h-3.5 bg-border-subtle mx-1" />

        <IconButton tooltip="Eyedropper (click to copy hex)" shortcut="E" active={eyedropperOn} onClick={() => setEyedropperOn((v) => !v)} disabled={!activeCanvas}><EyedropperIcon /></IconButton>
        <IconButton tooltip="Loupe (magnifier)" shortcut="L" active={loupeOn} onClick={() => setLoupeOn((v) => !v)} disabled={!activeCanvas}><LoupeIcon /></IconButton>

        <div className="w-px h-3.5 bg-border-subtle mx-1" />

        <Popover.Root open={infoOpen} onOpenChange={setInfoOpen}>
          <Popover.Trigger asChild>
            <button
              disabled={!focusedImage}
              title={
                lockedImage
                  ? "Image details & EXIF — locked image (D)"
                  : hoveredImage
                  ? "Image details & EXIF — click an image to lock (D)"
                  : "Image details & EXIF — click an image first (D)"
              }
              className={`flex items-center gap-1.5 h-[24px] px-2 rounded-md text-[11px] font-medium transition-colors outline-none disabled:opacity-30 disabled:cursor-default cursor-pointer ${
                infoOpen
                  ? "text-accent bg-accent/12"
                  : "text-text-muted hover:text-text-secondary hover:bg-bg-hover/80"
              }`}
            >
              <InfoOutlineIcon />
              <span>Details</span>
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="end"
              sideOffset={6}
              className="z-50 w-[320px] max-h-[70vh] overflow-y-auto rounded-lg border border-border-subtle bg-bg-elevated shadow-xl animate-in fade-in-0 zoom-in-95"
            >
              {focusedImage && (
                <ImageInfoPopover
                  image={focusedImage}
                  exif={exifByImage.get(focusedImage.id)}
                  exifLoaded={exifByImage.has(focusedImage.id)}
                  getAnalysis={getAnalysis}
                  headerNote={
                    lockedImage && lockedImage.id === focusedImage.id
                      ? "Locked image"
                      : hoveredImage && hoveredImage.id === focusedImage.id
                      ? "Hovered image"
                      : activeCanvas && activeCanvas.images.length > 1
                      ? "First image (click one to lock)"
                      : "Image details"
                  }
                />
              )}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        <div className="flex-1" />

        {activeCanvas && (
          <IconButton tooltip="Remove canvas" shortcut="⌫" onClick={() => removeCanvas(activeCanvas.id)}><TrashIcon /></IconButton>
        )}
      </div>

      {/* Body: thumbnails + stage */}
      <div className="flex-1 min-h-0 flex">
        <ThumbnailStrip
          canvases={canvases}
          activeId={activeCanvasId}
          onSelect={setActiveCanvasId}
          onRemove={removeCanvas}
          onDropToCanvas={addFilesToCanvas}
          addSlot={
            <AddPopover
              trigger={
                <button
                  className={`flex items-center justify-center rounded-md border-2 border-dashed transition-colors ${
                    dragOverPlus
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border-subtle/60 hover:border-accent/60 hover:text-accent text-text-faint"
                  }`}
                  style={{ aspectRatio: "1" }}
                  aria-label="Add new canvas (drop here for a new canvas)"
                  title="Click to add a new canvas — or drop images here"
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverPlus(true); }}
                  onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverPlus(true); }}
                  onDragLeave={(e) => { e.stopPropagation(); setDragOverPlus(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverPlus(false);
                    setDragOverStage(false);
                    const files = Array.from(e.dataTransfer.files);
                    if (files.length > 0) addFilesAsNewCanvas(files);
                  }}
                >
                  <span className="text-[18px] leading-none">+</span>
                </button>
              }
              onAddFiles={addFilesAsNewCanvas}
              onAddBlob={addBlobAsNewCanvas}
              onAddUrl={addUrlAsNewCanvas}
            />
          }
        />

        <div
          ref={setStageEl}
          className="relative flex-1 min-w-0 overflow-hidden select-none"
          style={{
            cursor: activeCanvas ? cursorStyle : "default",
            backgroundColor: "#0d0d12",
            backgroundImage:
              "linear-gradient(45deg, rgba(255,255,255,0.03) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.03) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.03) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.03) 75%)",
            backgroundSize: "16px 16px",
            backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
          }}
          onWheel={activeCanvas ? handleWheel : undefined}
          onMouseDown={activeCanvas ? handleMouseDown : undefined}
          onMouseMove={activeCanvas ? handleMouseMove : undefined}
          onMouseUp={activeCanvas ? handleMouseUp : undefined}
          onMouseLeave={activeCanvas ? handleMouseLeave : undefined}
          onDragEnter={(e) => { e.preventDefault(); setDragOverStage(true); }}
          onDragOver={(e) => { e.preventDefault(); setDragOverStage(true); }}
          onDragLeave={(e) => {
            // Only clear when actually leaving the stage (not when entering a child).
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
            setDragOverStage(false);
          }}
          onDrop={handleStageDrop}
        >
          <canvas ref={canvasRef} className="block" style={{ display: activeCanvas ? "block" : "none" }} />

          {/* Lock indicator (solid outline + lock pill). Shown even when the image isn't currently hovered. */}
          {activeCanvas && lockedImage && (
            <>
              <div
                className="absolute pointer-events-none rounded-sm"
                style={{
                  left: view.panX + lockedImage.localX * view.zoom,
                  top: view.panY + lockedImage.localY * view.zoom,
                  width: lockedImage.width * view.zoom,
                  height: lockedImage.height * view.zoom,
                  outline: "2px solid var(--cl-accent)",
                  outlineOffset: "-1px",
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.4) inset",
                }}
              />
              <div
                className="absolute pointer-events-none px-1.5 py-0.5 rounded-md text-[10px] font-mono text-white truncate inline-flex items-center gap-1 shadow-md"
                style={{
                  left: view.panX + lockedImage.localX * view.zoom,
                  top: Math.max(4, view.panY + lockedImage.localY * view.zoom - 22),
                  maxWidth: 200,
                  backgroundColor: "var(--cl-accent)",
                }}
              >
                <LockIcon />
                <span className="truncate">{lockedImage.name}</span>
              </div>
            </>
          )}

          {/* Hover indicator (dashed outline + filename pill). Suppressed if image is already locked, or while panning. */}
          {activeCanvas && activeCanvas.images.length > 1 && hoveredImage && hoveredImage.id !== lockedImageId && !panStateRef.current.active && (
            <>
              <div
                className="absolute pointer-events-none rounded-sm"
                style={{
                  left: view.panX + hoveredImage.localX * view.zoom,
                  top: view.panY + hoveredImage.localY * view.zoom,
                  width: hoveredImage.width * view.zoom,
                  height: hoveredImage.height * view.zoom,
                  outline: "1.5px dashed var(--cl-accent)",
                  outlineOffset: "-1px",
                  opacity: 0.65,
                }}
              />
              <div
                className="absolute pointer-events-none px-1.5 py-0.5 rounded-md text-[10px] font-mono text-white truncate"
                style={{
                  left: view.panX + hoveredImage.localX * view.zoom,
                  top: Math.max(4, view.panY + hoveredImage.localY * view.zoom - 22),
                  maxWidth: 200,
                  backgroundColor: "rgba(125, 100, 255, 0.85)",
                }}
              >
                {hoveredImage.name}
              </div>
            </>
          )}

          {!activeCanvas && (
            <EmptyDropZone onPick={() => hiddenFileInputRef.current?.click()} dragOver={dragOverStage} />
          )}
          {activeCanvas && eyedropperOn && pixel && cursor && (
            <EyedropperHUD cursor={cursor} pixel={pixel} stageSize={stageSize} />
          )}
          {activeCanvas && loupeOn && hoveredImage && cursor && (
            <Loupe cursor={cursor} image={hoveredImage} imgX={loupeImgX} imgY={loupeImgY} stageSize={stageSize} />
          )}

          {/* Drop-target overlay when dragging files over a populated stage */}
          {activeCanvas && dragOverStage && (
            <div className="absolute inset-2 rounded-lg border-2 border-dashed border-accent/70 bg-accent/[0.04] pointer-events-none flex items-end justify-center pb-3">
              <div className="px-2.5 py-1 rounded-md bg-accent text-white text-[11px] font-medium shadow-lg">
                Drop to add to this canvas
              </div>
            </div>
          )}

          {toast && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-md bg-black/70 backdrop-blur-sm text-white text-[11px] font-mono">
              {toast}
            </div>
          )}
        </div>
      </div>

      {/* Metadata footer — mode-aware */}
      {activeCanvas && (() => {
        const multi = activeCanvas.images.length > 1;
        const summaryMode = multi && !lockedImage && !hoveredImage;
        if (summaryMode) {
          const totalBytes = activeCanvas.images.reduce((s, i) => s + i.sizeBytes, 0);
          return (
            <div className="shrink-0 px-3 py-1.5 border-t border-border-subtle/60 text-[10.5px] font-mono text-text-faint flex items-center gap-2.5 select-none">
              <LayersIcon />
              <span className="uppercase tracking-[0.06em] text-text-muted">Canvas</span>
              <span>·</span>
              <span>{activeCanvas.images.length} images</span>
              <span>·</span>
              <span>{Math.round(activeBounds.width)} × {Math.round(activeBounds.height)}</span>
              <span>·</span>
              <span>{formatBytes(totalBytes)} total</span>
              <span className="flex-1" />
              <span className="text-text-faint/70 italic">Click an image to lock for inspection</span>
            </div>
          );
        }
        // Image mode (focusedImage exists)
        if (!focusedImage) return null;
        const isLocked = !!(lockedImage && lockedImage.id === focusedImage.id);
        const isHovered = !!(hoveredImage && hoveredImage.id === focusedImage.id);
        return (
          <div className="shrink-0 px-3 py-1.5 border-t border-border-subtle/60 text-[10.5px] font-mono text-text-faint flex items-center gap-2.5 select-none">
            <span
              className={isLocked ? "text-accent" : isHovered ? "text-accent/70" : "text-text-faint"}
              title={isLocked ? "Locked — click again or press Esc to unlock" : isHovered ? "Hovered — click to lock" : "Image"}
            >
              {isLocked ? <LockIcon /> : <TargetIcon />}
            </span>
            <span className="truncate max-w-[200px] text-text-secondary" title={focusedImage.name}>{focusedImage.name}</span>
            <span>·</span>
            <span>{focusedImage.width} × {focusedImage.height}</span>
            <span>·</span>
            <span>{focusedImage.format}</span>
            <span>·</span>
            <span>{formatBytes(focusedImage.sizeBytes)}</span>
            <span>·</span>
            <span>{aspectRatio(focusedImage.width, focusedImage.height)}</span>
            {multi && (
              <>
                <span>·</span>
                <span>image {activeCanvas.images.findIndex((i) => i.id === focusedImage.id) + 1}/{activeCanvas.images.length}</span>
              </>
            )}
            {pixel && (
              <>
                <span className="flex-1" />
                <span>x:{pixel.x} y:{pixel.y}</span>
                <span
                  key={rgbToHex(pixel.r, pixel.g, pixel.b)}
                  className="inline-block w-3 h-3 rounded-sm border border-white/10"
                  style={{ backgroundColor: `rgb(${pixel.r},${pixel.g},${pixel.b})` }}
                />
                <span>{rgbToHex(pixel.r, pixel.g, pixel.b)}</span>
              </>
            )}
          </div>
        );
      })()}

      {/* Hidden file input used only by the empty-state drop zone */}
      <input
        ref={hiddenFileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFilesAsNewCanvas(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
    </div>
  );
}

/* ── Register ── */

registerOutputView({
  id: "image-inspector",
  name: "Image Inspector",
  icon: InspectorTabIcon,
  parse: (output) => output,
  component: ImageInspectorViewer,
});
