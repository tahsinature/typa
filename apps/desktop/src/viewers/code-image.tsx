import { useEffect, useState, useRef, useCallback } from "react";
import { createHighlighter, type Highlighter } from "shiki";
import { toPng, toCanvas } from "html-to-image";
import { invoke } from "@tauri-apps/api/core";
import { format as prettierFormat } from "prettier/standalone";
import prettierBabel from "prettier/plugins/babel";
import prettierEstree from "prettier/plugins/estree";
import prettierTs from "prettier/plugins/typescript";
import prettierHtml from "prettier/plugins/html";
import prettierCss from "prettier/plugins/postcss";
import prettierMarkdown from "prettier/plugins/markdown";
import prettierYaml from "prettier/plugins/yaml";
import prettierGraphql from "prettier/plugins/graphql";
import { IconButton } from "@/components/ui/icon-button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { registerViewer } from "./registry";

/* ── Background Themes ── */
const BG_THEMES = [
  { id: "candy", name: "Candy", bg: "linear-gradient(140deg, #e879f9, #f472b6, #fb923c)" },
  { id: "oceanic", name: "Oceanic", bg: "linear-gradient(140deg, #06b6d4, #3b82f6, #8b5cf6)" },
  { id: "sunset", name: "Sunset", bg: "linear-gradient(140deg, #f97316, #ef4444, #ec4899)" },
  { id: "forest", name: "Forest", bg: "linear-gradient(140deg, #22c55e, #14b8a6, #06b6d4)" },
  { id: "midnight", name: "Midnight", bg: "linear-gradient(140deg, #6366f1, #8b5cf6, #a855f7)" },
  { id: "mono", name: "Mono", bg: "linear-gradient(140deg, #525252, #404040, #262626)" },
  { id: "crimson", name: "Crimson", bg: "linear-gradient(140deg, #dc2626, #b91c1c, #991b1b)" },
  { id: "aurora", name: "Aurora", bg: "linear-gradient(140deg, #4ade80, #2dd4bf, #818cf8)" },
] as const;

const PADDING_OPTIONS = [16, 32, 64, 128] as const;
const SHIKI_DARK_THEME = "vitesse-dark";
const SHIKI_LIGHT_THEME = "vitesse-light";

/* ── Language Detection ── */
const LANG_PATTERNS: [RegExp, string][] = [
  [/^\s*<(!DOCTYPE|html|div|span|head|body|script|style|link|meta|form|table|p\b|a\b|ul\b|li\b|h[1-6])/im, "html"],
  [/^\s*<\?php/m, "php"],
  [/<[A-Z][a-zA-Z]*[\s/>]|import\s+React|from\s+['"]react['"]|jsx|tsx/m, "tsx"],
  [/^(import|export)\s+.*(from\s+['"]|{)/m, "typescript"],
  [/:\s*(string|number|boolean|void|any)\b|interface\s+\w+|type\s+\w+\s*=/m, "typescript"],
  [/^(const|let|var|function|class|=>|===|!==|console\.)/m, "javascript"],
  [/^\s*\{[\s\S]*"[\w]+":\s/m, "json"],
  [/^---\n[\s\S]*?\n---/m, "yaml"],
  [/^\s*(def |class |import |from .* import|if __name__|print\()/m, "python"],
  [/^\s*(fn |let mut |impl |use |pub |struct |enum |mod |match )/m, "rust"],
  [/^\s*(func |package |import\s*\(|:=|go\s+func)/m, "go"],
  [/^\s*(public\s+class|private\s+|System\.out|@Override|import\s+java\.)/m, "java"],
  [/^\s*(#include|int\s+main|printf|scanf|void\s+\w+\(|->|::)/m, "cpp"],
  [/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|FROM|WHERE)\b/im, "sql"],
  [/^\s*(\$[\w]+\s*=|function\s+\w+\s*\(|echo\s|<?php)/m, "php"],
  [/^\s*(apiVersion:|kind:|metadata:|spec:)/m, "yaml"],
  [/^\s*[.#][\w-]+\s*\{|@media|@import|:root/m, "css"],
  [/^\s*\$[\w-]+:\s|@mixin|@include|@extend/m, "scss"],
  [/^\s*(FROM|RUN|CMD|COPY|EXPOSE|ENTRYPOINT|WORKDIR)\b/m, "dockerfile"],
  [/^#!/m, "bash"],
  [/^\s*([\w-]+)\s*=/m, "ini"],
];

function detectLanguage(code: string): string {
  for (const [pattern, lang] of LANG_PATTERNS) {
    if (pattern.test(code)) return lang;
  }
  return "plaintext";
}

const POPULAR_LANGUAGES: string[] = [
  "plaintext", "javascript", "typescript", "tsx", "jsx", "python", "rust", "go",
  "java", "cpp", "c", "csharp", "php", "ruby", "swift", "kotlin", "html",
  "css", "scss", "json", "yaml", "toml", "sql", "bash", "dockerfile",
  "markdown", "xml", "graphql", "prisma",
];

/* ── Highlighter Singleton ── */
let highlighterPromise: Promise<Highlighter> | null = null;
const loadedLanguages = new Set<string>();

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [SHIKI_DARK_THEME, SHIKI_LIGHT_THEME],
      langs: ["plaintext"],
    });
    loadedLanguages.add("plaintext");
  }
  return highlighterPromise;
}

async function ensureLanguage(hl: Highlighter, lang: string) {
  if (!loadedLanguages.has(lang)) {
    try {
      await hl.loadLanguage(lang as any);
      loadedLanguages.add(lang);
    } catch {}
  }
}

/* ── Image export options ── */
const imageOptions = { pixelRatio: 2, fontEmbedCSS: "", skipFonts: true };

/* ── Prettier ── */
const PRETTIER_PARSERS: Record<string, { parser: string; plugins: any[] }> = {
  javascript: { parser: "babel", plugins: [prettierBabel, prettierEstree] },
  typescript: { parser: "typescript", plugins: [prettierTs, prettierEstree] },
  tsx: { parser: "typescript", plugins: [prettierTs, prettierEstree] },
  jsx: { parser: "babel", plugins: [prettierBabel, prettierEstree] },
  json: { parser: "json", plugins: [prettierBabel, prettierEstree] },
  html: { parser: "html", plugins: [prettierHtml] },
  css: { parser: "css", plugins: [prettierCss] },
  scss: { parser: "scss", plugins: [prettierCss] },
  markdown: { parser: "markdown", plugins: [prettierMarkdown] },
  yaml: { parser: "yaml", plugins: [prettierYaml] },
  graphql: { parser: "graphql", plugins: [prettierGraphql] },
};

async function formatCode(code: string, lang: string): Promise<string> {
  const entry = PRETTIER_PARSERS[lang];
  if (entry) {
    try {
      const result = await prettierFormat(code, {
        parser: entry.parser,
        plugins: entry.plugins,
        printWidth: 80,
        tabWidth: 2,
        singleQuote: true,
        trailingComma: "all",
      });
      return result.trimEnd();
    } catch (e) {
      console.error("Prettier format failed:", e);
    }
  }
  const lines = code.split("\n").map((l) => l.trimEnd());
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.map((l) => l.replace(/\t/g, "  ")).join("\n");
}

/* ── Toolbar Icons ── */
function BgIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="1" y="1" width="14" height="14" rx="3" />
      <path d="M1 11l4-4 3 3 2-2 5 5" />
    </svg>
  );
}
function DarkModeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M6 .278a.77.77 0 01.08.858 7.2 7.2 0 00-.878 3.46c0 4.021 3.278 7.277 7.318 7.277q.792-.001 1.533-.16a.79.79 0 01.81.316.73.73 0 01-.031.893A8.35 8.35 0 018.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.75.75 0 016 .278" />
    </svg>
  );
}
function LightModeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 12a4 4 0 100-8 4 4 0 000 8M8 0a.5.5 0 01.5.5v2a.5.5 0 01-1 0v-2A.5.5 0 018 0m0 13a.5.5 0 01.5.5v2a.5.5 0 01-1 0v-2A.5.5 0 018 13m8-5a.5.5 0 01-.5.5h-2a.5.5 0 010-1h2a.5.5 0 01.5.5M3 8a.5.5 0 01-.5.5h-2a.5.5 0 010-1h2A.5.5 0 013 8m10.657-5.657a.5.5 0 010 .707l-1.414 1.415a.5.5 0 11-.707-.708l1.414-1.414a.5.5 0 01.707 0m-9.193 9.193a.5.5 0 010 .707L3.05 13.657a.5.5 0 01-.707-.707l1.414-1.414a.5.5 0 01.707 0m9.193 2.121a.5.5 0 01-.707 0l-1.414-1.414a.5.5 0 01.707-.707l1.414 1.414a.5.5 0 010 .707M4.464 4.465a.5.5 0 01-.707 0L2.343 3.05a.5.5 0 11.707-.707l1.414 1.414a.5.5 0 010 .708" />
    </svg>
  );
}
function HashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8.39 12.648a1 1 0 00-.015.18c0 .305.21.508.5.508.266 0 .492-.172.555-.477l.554-2.703h1.204c.421 0 .617-.234.617-.547 0-.312-.188-.53-.617-.53h-.985l.516-2.524h1.265c.43 0 .618-.227.618-.547 0-.313-.188-.524-.618-.524h-1.046l.476-2.304a1 1 0 00.016-.164.51.51 0 00-.516-.516.54.54 0 00-.539.43l-.523 2.554H7.617l.477-2.304c.008-.04.015-.118.015-.164a.51.51 0 00-.523-.516.54.54 0 00-.531.43L6.53 5.484H5.414c-.43 0-.617.22-.617.532s.187.539.617.539h.906l-.515 2.523H4.609c-.421 0-.609.219-.609.531s.188.547.61.547h.976l-.516 2.492c-.008.04-.015.125-.015.18 0 .305.21.508.5.508.265 0 .492-.172.554-.477l.555-2.703h2.242zm-1-6.109h2.266l-.515 2.563H6.859l.532-2.563z" />
    </svg>
  );
}
function FormatIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2.5 3a.5.5 0 000 1h11a.5.5 0 000-1h-11zM2.5 7a.5.5 0 000 1h7a.5.5 0 000-1h-7zM2.5 11a.5.5 0 000 1h11a.5.5 0 000-1h-11z" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="9" height="9" rx="1.5" />
      <path d="M3 11H2.5A1.5 1.5 0 011 9.5v-7A1.5 1.5 0 012.5 1h7A1.5 1.5 0 0111 2.5V3" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1v10M4 8l4 4 4-4M2 14h12" />
    </svg>
  );
}
function SpinnerIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="animate-spin">
      <circle cx="12" cy="12" r="10" stroke="var(--cl-border)" strokeWidth="2.5" />
      <path d="M12 2a10 10 0 019.95 9" stroke="var(--cl-accent)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--cl-result)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--cl-danger)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

/* ── Viewer Component ── */
function CodeImageViewer({ data, theme: appTheme }: { data: string; theme: "dark" | "light" }) {
  const rawCode = data ?? "";
  const code = rawCode.split("\n").reduce((acc, line) => {
    if (acc.length === 0 && line.trim() === "") return acc;
    acc.push(line);
    return acc;
  }, [] as string[]).join("\n").trimEnd();

  const [bgThemeId, setBgThemeId] = useState<string>("oceanic");
  const [showBg, setShowBg] = useState(true);
  const [darkMode, setDarkMode] = useState(appTheme === "dark");
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [padding, setPadding] = useState<number>(64);
  const [language, setLanguage] = useState<string>("plaintext");
  const [autoDetected, setAutoDetected] = useState<string>("plaintext");
  const [isAuto, setIsAuto] = useState(true);
  const [width, setWidth] = useState(680);
  const [formattedCode, setFormattedCode] = useState(code);
  const lastInputRef = useRef(code);

  const captureRef = useRef<HTMLDivElement>(null);
  const [tokenLines, setTokenLines] = useState<{ content: string; color?: string }[][]>([]);
  const [dragging, setDragging] = useState<"left" | "right" | null>(null);
  const dragStartRef = useRef({ x: 0, width: 0 });
  const [copyStatus, setCopyStatus] = useState<"idle" | "copying" | "copied" | "failed">("idle");

  useEffect(() => {
    if (code !== lastInputRef.current) {
      lastInputRef.current = code;
      setFormattedCode(code);
    }
  }, [code]);

  useEffect(() => {
    const detected = detectLanguage(formattedCode);
    setAutoDetected(detected);
    if (isAuto) setLanguage(detected);
  }, [formattedCode, isAuto]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!formattedCode.trim()) { setTokenLines([]); return; }
      const hl = await getHighlighter();
      const lang = loadedLanguages.has(language) ? language : "plaintext";
      await ensureLanguage(hl, lang);
      const { tokens } = hl.codeToTokens(formattedCode, {
        lang: lang as any,
        theme: darkMode ? SHIKI_DARK_THEME : SHIKI_LIGHT_THEME,
      });
      if (!cancelled) {
        setTokenLines(tokens.map((line) => line.map((t) => ({ content: t.content, color: t.color }))));
      }
    })();
    return () => { cancelled = true; };
  }, [formattedCode, language, darkMode]);

  const onDragStart = useCallback((side: "left" | "right", e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(side);
    dragStartRef.current = { x: e.clientX, width };
  }, [width]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.x;
      const delta = dragging === "right" ? dx : -dx;
      setWidth(Math.max(320, Math.min(1200, dragStartRef.current.width + delta * 2)));
    };
    const onUp = () => setDragging(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging]);

  const bgTheme = BG_THEMES.find((t) => t.id === bgThemeId) ?? BG_THEMES[0];

  const handleCopy = useCallback(async () => {
    if (!captureRef.current) return;
    setCopyStatus("copying");
    try {
      const canvas = await toCanvas(captureRef.current, imageOptions);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No canvas context");
      const { width, height } = canvas;
      const imageData = ctx.getImageData(0, 0, width, height);
      await invoke("copy_image_to_clipboard", { rgba: Array.from(imageData.data), width, height });
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 1500);
    } catch (e) {
      console.error("Copy failed:", e);
      setCopyStatus("failed");
      setTimeout(() => setCopyStatus("idle"), 1500);
    }
  }, []);

  const handleExport = useCallback(async () => {
    if (!captureRef.current) return;
    try {
      const dataUrl = await toPng(captureRef.current, imageOptions);
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const buffer = await blob.arrayBuffer();
      await invoke("save_png_file", { pngData: Array.from(new Uint8Array(buffer)) });
    } catch (e) {
      console.error("Export failed:", e);
    }
  }, []);

  const handleFormat = useCallback(async () => {
    const result = await formatCode(formattedCode, language);
    setFormattedCode(result);
  }, [formattedCode, language]);

  const codeBg = darkMode ? "#121212" : "#ffffff";
  const codeFg = darkMode ? "#d4d4d4" : "#1e1e1e";
  const lineNumColor = darkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)";
  const lineCount = tokenLines.length || formattedCode.split("\n").length;

  if (!rawCode.trim()) {
    return (
      <div className="h-full flex items-center justify-center bg-bg">
        <span className="text-text-faint text-[13px]">Paste code in the input to generate an image</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden relative bg-bg">
      {/* ── Status Overlay ── */}
      {copyStatus !== "idle" && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-bg/95 backdrop-blur-sm">
          {copyStatus === "copying" && <><SpinnerIcon /><span className="text-text-muted text-[13px] font-medium">Copying to clipboard...</span></>}
          {copyStatus === "copied" && <><CheckIcon /><span className="text-result text-[13px] font-medium">Copied to clipboard!</span></>}
          {copyStatus === "failed" && <><XIcon /><span className="text-danger text-[13px] font-medium">Copy failed</span></>}
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-1 px-2 h-[36px] shrink-0 border-b border-border-subtle">
        {/* Theme swatches */}
        <div className="flex items-center gap-0.5 mr-1">
          {BG_THEMES.map((t) => (
            <Tooltip key={t.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setBgThemeId(t.id)}
                  className="w-[18px] h-[18px] rounded-full border-[1.5px] transition-all cursor-pointer"
                  style={{
                    background: t.bg,
                    borderColor: bgThemeId === t.id ? "var(--cl-accent)" : "transparent",
                    transform: bgThemeId === t.id ? "scale(1.2)" : "scale(1)",
                  }}
                />
              </TooltipTrigger>
              <TooltipContent>{t.name}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        <div className="w-px h-3.5 bg-border-subtle mx-0.5" />

        <IconButton tooltip="Toggle background" active={showBg} onClick={() => setShowBg(!showBg)}><BgIcon /></IconButton>
        <IconButton tooltip={darkMode ? "Switch to light" : "Switch to dark"} active={darkMode} onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? <DarkModeIcon /> : <LightModeIcon />}
        </IconButton>
        <IconButton tooltip="Toggle line numbers" active={showLineNumbers} onClick={() => setShowLineNumbers(!showLineNumbers)}><HashIcon /></IconButton>

        <div className="w-px h-3.5 bg-border-subtle mx-0.5" />

        {/* Padding dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-[24px] px-2 rounded-md text-[11px] text-text-muted hover:text-text-secondary hover:bg-bg-hover/80 transition-colors cursor-pointer outline-none">
              {padding}px
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Padding</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {PADDING_OPTIONS.map((p) => (
              <DropdownMenuItem key={p} onClick={() => setPadding(p)}>
                <span className={padding === p ? "text-accent font-medium" : ""}>{p}px</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Language dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-[24px] px-2 rounded-md text-[11px] text-text-muted hover:text-text-secondary hover:bg-bg-hover/80 transition-colors cursor-pointer outline-none">
              {isAuto ? `Auto (${autoDetected})` : language}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-[300px] overflow-auto">
            <DropdownMenuItem onClick={() => { setIsAuto(true); setLanguage(autoDetected); }}>
              <span className={isAuto ? "text-accent font-medium" : ""}>Auto ({autoDetected})</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {POPULAR_LANGUAGES.map((l) => (
              <DropdownMenuItem key={l} onClick={() => { setIsAuto(false); setLanguage(l); }}>
                <span className={!isAuto && language === l ? "text-accent font-medium" : ""}>{l}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1" />

        <IconButton tooltip="Format code" onClick={handleFormat}><FormatIcon /></IconButton>
        <IconButton tooltip="Copy to clipboard" onClick={handleCopy}><CopyIcon /></IconButton>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleExport}
              className="h-[24px] px-2.5 rounded-md text-[11px] font-medium text-white bg-accent hover:bg-accent-hover transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <DownloadIcon />
              Export
            </button>
          </TooltipTrigger>
          <TooltipContent>Download as PNG</TooltipContent>
        </Tooltip>
      </div>

      {/* ── Preview ── */}
      <div
        className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-8"
        style={{ backgroundColor: darkMode ? "#0d0d0d" : "#f0f0f0" }}
      >
        {/* Drag left */}
        <div className="w-2 self-stretch cursor-col-resize flex items-center justify-center shrink-0" onMouseDown={(e) => onDragStart("left", e)}>
          <div className="w-1 h-8 rounded-full transition-colors" style={{ backgroundColor: dragging === "left" ? "var(--cl-accent)" : "var(--text-faint)" }} />
        </div>

        {/* Capture */}
        <div
          ref={captureRef}
          style={{
            width,
            background: showBg ? bgTheme.bg : "transparent",
            padding: showBg ? padding : 0,
            borderRadius: showBg ? 12 : 0,
            transition: "padding 0.2s ease, width 0.2s ease",
          }}
        >
          <div style={{ backgroundColor: codeBg, borderRadius: 10, overflow: "hidden", boxShadow: showBg ? "0 20px 68px rgba(0,0,0,0.55)" : "none" }}>
            {/* Window dots */}
            <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 8 }}>
              {["#ff5f57", "#febc2e", "#28c840"].map((c, i) => (
                <div key={i} style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: c }} />
              ))}
            </div>

            {/* Code */}
            <div style={{ padding: "0 16px 16px", display: "flex", gap: 16, overflow: "hidden", fontSize: 13, lineHeight: "1.6", fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace" }}>
              {showLineNumbers && (
                <div style={{ userSelect: "none", flexShrink: 0, textAlign: "right", color: lineNumColor }}>
                  {Array.from({ length: lineCount }, (_, i) => (
                    <div key={i} style={{ height: "1.6em" }}>{i + 1}</div>
                  ))}
                </div>
              )}
              <div style={{ flex: 1, overflow: "hidden", color: codeFg, whiteSpace: "pre" }}>
                {tokenLines.map((line, i) => (
                  <div key={i} style={{ height: "1.6em" }}>
                    {line.length === 0 ? "\n" : line.map((token, j) => (
                      <span key={j} style={{ color: token.color }}>{token.content}</span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Drag right */}
        <div className="w-2 self-stretch cursor-col-resize flex items-center justify-center shrink-0" onMouseDown={(e) => onDragStart("right", e)}>
          <div className="w-1 h-8 rounded-full transition-colors" style={{ backgroundColor: dragging === "right" ? "var(--cl-accent)" : "var(--text-faint)" }} />
        </div>
      </div>
    </div>
  );
}

/* ── Icon ── */
function CodeImageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M6.002 5.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
      <path d="M2.002 1a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V3a2 2 0 00-2-2h-12zm12 1a1 1 0 011 1v6.5l-3.777-1.947a.5.5 0 00-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 00-.63.062L1.002 12V3a1 1 0 011-1h12z" />
    </svg>
  );
}

registerViewer({
  parse: (output) => output,
  id: "code-image",
  name: "Code Image",
  icon: CodeImageIcon,
  component: CodeImageViewer,
});
