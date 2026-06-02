import { useCallback, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { invoke } from "@tauri-apps/api/core";

/* ── Icons ── */

const iconBase = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const FolderIcon = () => (
  <svg {...iconBase}>
    <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
  </svg>
);
const ClipboardIcon = () => (
  <svg {...iconBase}>
    <rect x="8" y="3" width="8" height="3" rx="1" />
    <path d="M8 4.5H6a2 2 0 00-2 2V20a2 2 0 002 2h12a2 2 0 002-2V6.5a2 2 0 00-2-2h-2" />
  </svg>
);
const LinkIcon = () => (
  <svg {...iconBase}>
    <path d="M10 13.5l4-4M8.5 6.5l1.5-1.5a3.5 3.5 0 015 5L13 12M11 17l-1.5 1.5a3.5 3.5 0 01-5-5L6 12" />
  </svg>
);
const ChevronRightIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const SpinnerIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-spin">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

/* ── Tauri clipboard helpers ── */

interface ClipboardImage {
  rgba: number[];
  width: number;
  height: number;
}

async function readClipboardImageAsBlob(): Promise<Blob | null> {
  const img = await invoke<ClipboardImage | null>("read_image_from_clipboard");
  if (!img || img.width === 0 || img.height === 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const imgData = ctx.createImageData(img.width, img.height);
  imgData.data.set(new Uint8ClampedArray(img.rgba));
  ctx.putImageData(imgData, 0, 0);
  return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

/* ── Option row ── */

function OptionRow({
  icon,
  label,
  subtitle,
  active,
  loading,
  onClick,
  trailing,
}: {
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  active?: boolean;
  loading?: boolean;
  onClick: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left disabled:cursor-wait ${
        active ? "bg-accent/10" : "hover:bg-bg-hover"
      }`}
    >
      <span
        className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-md border ${
          active ? "border-accent/40 text-accent bg-accent/5" : "border-border-subtle/70 text-text-muted bg-white/[0.02]"
        }`}
      >
        {loading ? <SpinnerIcon /> : icon}
      </span>
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className={`text-[12px] leading-tight ${active ? "text-accent font-medium" : "text-text-secondary"}`}>{label}</span>
        <span className="text-[10.5px] leading-tight text-text-faint truncate">{subtitle}</span>
      </span>
      {trailing && <span className="shrink-0 text-text-faint">{trailing}</span>}
    </button>
  );
}

/* ── Component ── */

export interface AddPopoverProps {
  trigger: React.ReactNode;
  onAddFiles: (files: File[]) => void | Promise<void>;
  onAddBlob: (blob: Blob, name?: string) => void | Promise<void>;
  onAddUrl: (url: string) => Promise<{ error?: string }>;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

export function AddPopover({
  trigger,
  onAddFiles,
  onAddBlob,
  onAddUrl,
  side = "right",
  align = "end",
}: AddPopoverProps) {
  const [open, setOpen] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  const [url, setUrl] = useState("");
  const [pasting, setPasting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setUrlMode(false);
    setUrl("");
    setPasting(false);
    setFetching(false);
    setErr(null);
  }, []);

  const handleOpenChange = useCallback((v: boolean) => {
    setOpen(v);
    if (!v) reset();
  }, [reset]);

  const handleBrowse = () => {
    setErr(null);
    fileInputRef.current?.click();
  };

  const handlePaste = useCallback(async () => {
    setErr(null);
    setPasting(true);
    try {
      const blob = await readClipboardImageAsBlob();
      if (!blob) {
        setErr("No image in clipboard");
        return;
      }
      await onAddBlob(blob, "Clipboard image");
      handleOpenChange(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Clipboard read failed");
    } finally {
      setPasting(false);
    }
  }, [onAddBlob, handleOpenChange]);

  const handleUrlSubmit = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setErr(null);
    setFetching(true);
    const result = await onAddUrl(trimmed);
    setFetching(false);
    if (result.error) {
      setErr(result.error);
    } else {
      handleOpenChange(false);
    }
  }, [url, onAddUrl, handleOpenChange]);

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          align={align}
          sideOffset={8}
          className="z-50 w-[300px] rounded-xl border border-border-subtle bg-bg-elevated shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95"
        >
          {/* Header */}
          <div className="px-3.5 pt-3 pb-2">
            <div className="text-[12.5px] font-semibold text-text-secondary leading-tight">Add to a new canvas</div>
            <div className="text-[10.5px] text-text-faint mt-0.5 leading-snug">
              Each option creates a fresh canvas. To add to the current one, drop or press ⌘V on the canvas.
            </div>
          </div>

          <div className="h-px bg-border-subtle/50" />

          {/* Options */}
          <div className="py-1">
            <OptionRow
              icon={<FolderIcon />}
              label="Browse files"
              subtitle="Pick one or more images from disk"
              onClick={handleBrowse}
            />
            <OptionRow
              icon={<ClipboardIcon />}
              label="Paste from clipboard"
              subtitle={pasting ? "Reading clipboard…" : "Use the current clipboard image"}
              loading={pasting}
              onClick={handlePaste}
            />
            <OptionRow
              icon={<LinkIcon />}
              label="From URL"
              subtitle={urlMode ? "Enter a URL below" : "Fetch an image from a web link"}
              active={urlMode}
              onClick={() => { setErr(null); setUrlMode((v) => !v); }}
              trailing={<ChevronRightIcon />}
            />
          </div>

          {/* URL input */}
          {urlMode && (
            <div className="px-3.5 pb-3 pt-1 flex flex-col gap-2">
              <input
                autoFocus
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleUrlSubmit(); }}
                placeholder="https://example.com/image.png"
                className="w-full h-8 px-2.5 text-[12px] rounded-md bg-bg-input border border-border-subtle outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 placeholder:text-text-faint text-text-secondary"
              />
              <button
                disabled={fetching || !url.trim()}
                onClick={handleUrlSubmit}
                className="h-8 rounded-md bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-[12px] font-medium transition-colors inline-flex items-center justify-center gap-1.5"
              >
                {fetching ? (<><SpinnerIcon /> Fetching…</>) : "Add"}
              </button>
            </div>
          )}

          {/* Error banner */}
          {err && (
            <div
              className="mx-3 mb-3 px-2.5 py-1.5 rounded-md text-[11px] flex items-start gap-2"
              style={{ background: "rgba(248, 81, 73, 0.08)", color: "var(--cl-danger)" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-px">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4M12 16v.01" />
              </svg>
              <span className="leading-snug">{err}</span>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onAddFiles(Array.from(e.target.files));
                handleOpenChange(false);
              }
              e.target.value = "";
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
