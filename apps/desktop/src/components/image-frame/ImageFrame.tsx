import { useCallback, useRef, useState, type ReactNode } from "react";
import { toBlob, toCanvas } from "html-to-image";
import { ImageCopyButton } from "@/components/ImageCopyButton";
import { ImageExportButton } from "@/components/ImageExportButton";
import { OpenWithButton } from "@/components/OpenWithButton";
import { IconButton } from "@/components/ui/icon-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { saveImageFile, type ImageFileBaseName } from "@/lib/image-file";
import { useImageSizeReport } from "@/lib/use-image-size-report";
import { BG_THEMES, PADDING_OPTIONS, cardColors, type BgThemeId, type CardColors } from "./frame-themes";
import { BgIcon, DarkModeIcon, LightModeIcon } from "./icons";
import { useResizableWidth } from "./useResizableWidth";

const CAPTURE_OPTIONS = { pixelRatio: 2, fontEmbedCSS: "", skipFonts: true };

interface ImageFrameProps {
  baseName: ImageFileBaseName;
  theme: "dark" | "light";
  /** Changes whenever the rendered content changes, so the exported size is re-measured. */
  contentKey: string;
  defaultWidth?: number;
  /** Viewer-specific controls shown after the frame options. */
  toolbarStart?: ReactNode;
  /** Viewer-specific actions shown before Copy / Open with / Export. */
  toolbarEnd?: ReactNode;
  children: (card: { darkMode: boolean; colors: CardColors }) => ReactNode;
}

/** Window-style card on a gradient background, with copy, open with and export actions. */
export function ImageFrame({ baseName, theme, contentKey, defaultWidth = 680, toolbarStart, toolbarEnd, children }: ImageFrameProps) {
  const [bgThemeId, setBgThemeId] = useState<BgThemeId>("oceanic");
  const [showBg, setShowBg] = useState(true);
  const [darkMode, setDarkMode] = useState(theme === "dark");
  const [padding, setPadding] = useState<number>(64);
  const { width, dragging, startDrag } = useResizableWidth(defaultWidth);
  const captureRef = useRef<HTMLDivElement>(null);
  const colors = cardColors(darkMode);
  const background = BG_THEMES.find((t) => t.id === bgThemeId)?.bg ?? BG_THEMES[0].bg;

  const createCanvas = useCallback(async () => {
    if (!captureRef.current) throw new Error("The preview is not ready");
    return toCanvas(captureRef.current, CAPTURE_OPTIONS);
  }, []);

  const createPng = useCallback(async () => {
    if (!captureRef.current) throw new Error("The preview is not ready");
    const png = await toBlob(captureRef.current, CAPTURE_OPTIONS);
    if (!png) throw new Error("Could not create the image");
    return png;
  }, []);

  useImageSizeReport(createPng, [bgThemeId, showBg, darkMode, padding, width, contentKey].join("|"));

  const handleExport = useCallback(async () => {
    try {
      await saveImageFile(await createPng(), baseName);
    } catch (error) {
      console.error("Export failed:", error);
    }
  }, [createPng, baseName]);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-bg">
      <div className="flex items-center gap-1 px-2 h-[36px] shrink-0 border-b border-border-subtle">
        <ThemeSwatches selectedId={bgThemeId} onSelect={setBgThemeId} />
        <Divider />
        <IconButton tooltip="Toggle background" active={showBg} onClick={() => setShowBg(!showBg)}><BgIcon /></IconButton>
        <IconButton tooltip={darkMode ? "Switch to light" : "Switch to dark"} active={darkMode} onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? <DarkModeIcon /> : <LightModeIcon />}
        </IconButton>
        <Divider />
        <PaddingDropdown value={padding} onChange={setPadding} />
        {toolbarStart}

        <div className="flex-1" />

        {toolbarEnd}
        <ImageCopyButton createCanvas={createCanvas} />
        <OpenWithButton createPng={createPng} baseName={baseName} />
        <ImageExportButton onExport={handleExport} />
      </div>

      <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-8" style={{ backgroundColor: darkMode ? "#0d0d0d" : "#f0f0f0" }}>
        <DragHandle active={dragging === "left"} onMouseDown={(event) => startDrag("left", event)} />
        <div
          ref={captureRef}
          style={{
            width,
            background: showBg ? background : "transparent",
            padding: showBg ? padding : 0,
            borderRadius: showBg ? 12 : 0,
            transition: "padding 0.2s ease, width 0.2s ease",
          }}
        >
          <div style={{ backgroundColor: colors.background, borderRadius: 10, overflow: "hidden", boxShadow: showBg ? "0 20px 68px rgba(0,0,0,0.55)" : "none" }}>
            <WindowDots />
            {children({ darkMode, colors })}
          </div>
        </div>
        <DragHandle active={dragging === "right"} onMouseDown={(event) => startDrag("right", event)} />
      </div>
    </div>
  );
}

function ThemeSwatches({ selectedId, onSelect }: { selectedId: BgThemeId; onSelect: (id: BgThemeId) => void }) {
  return (
    <div className="flex items-center gap-0.5 mr-1">
      {BG_THEMES.map((theme) => (
        <Tooltip key={theme.id}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={theme.name}
              onClick={() => onSelect(theme.id)}
              className="w-[18px] h-[18px] rounded-full border-[1.5px] transition-all cursor-pointer"
              style={{
                background: theme.bg,
                borderColor: selectedId === theme.id ? "var(--cl-accent)" : "transparent",
                transform: selectedId === theme.id ? "scale(1.2)" : "scale(1)",
              }}
            />
          </TooltipTrigger>
          <TooltipContent>{theme.name}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

function PaddingDropdown({ value, onChange }: { value: number; onChange: (padding: number) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="h-[24px] px-2 rounded-md text-[11px] text-text-muted hover:text-text-secondary hover:bg-bg-hover/80 transition-colors cursor-pointer outline-none">
          {value}px
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Padding</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PADDING_OPTIONS.map((option) => (
          <DropdownMenuItem key={option} onClick={() => onChange(option)}>
            <span className={value === option ? "text-accent font-medium" : ""}>{option}px</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WindowDots() {
  return (
    <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 8 }}>
      {["#ff5f57", "#febc2e", "#28c840"].map((color) => (
        <div key={color} style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: color }} />
      ))}
    </div>
  );
}

function DragHandle({ active, onMouseDown }: { active: boolean; onMouseDown: (event: React.MouseEvent) => void }) {
  return (
    <div className="w-2 self-stretch cursor-col-resize flex items-center justify-center shrink-0" onMouseDown={onMouseDown}>
      <div className="w-1 h-8 rounded-full transition-colors" style={{ backgroundColor: active ? "var(--cl-accent)" : "var(--text-faint)" }} />
    </div>
  );
}

export function Divider() {
  return <div className="w-px h-3.5 bg-border-subtle mx-0.5" />;
}
