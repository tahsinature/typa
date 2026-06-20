import { useState, useMemo, useRef, useEffect, type ReactNode } from "react";
import { HighlightIcon, WrapIcon } from "@/components/Icons";
import { IconButton } from "@/components/ui/icon-button";
import { useSettingsStore } from "@/stores/settingsStore";
import { registerOutputView } from "./registry";
import {
  search,
  replaceAll,
  replaceSpan,
  type Match,
  type SearchOptions,
} from "./text-finder-search";

/* ── Tunables ── */

const MATCH_BG = "color-mix(in srgb, #facc15 38%, transparent)";
const ACTIVE_BG = "#f59e0b";
// Soft cap so a huge clipboard can't drown the DOM in line nodes. The filter
// (grep) view is naturally bounded to matched lines, so the cap rarely bites.
const MAX_RENDER_LINES = 5000;
const MIN_FONT = 8;
const MAX_FONT = 40;

/* ── Small inline icons ── */

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ReplaceIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4h5v5" />
      <path d="M19 4 9 14" />
      <path d="M10 20H5v-5" />
      <path d="M5 20 15 10" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h18l-7 8v6l-4 2v-8z" />
    </svg>
  );
}

function HashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
    </svg>
  );
}

function ChevronIcon({ dir }: { dir: "up" | "down" }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: dir === "up" ? "rotate(180deg)" : undefined }}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/* ── Toolbar building blocks ── */

function TogglePill({ label, title, active, onClick }: { label: string; title: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={`h-[24px] min-w-[26px] px-1.5 rounded-md text-[11px] font-mono font-semibold transition-colors duration-150 cursor-pointer ${
        active ? "bg-accent/15 text-accent" : "text-text-faint hover:text-text-secondary hover:bg-bg-hover/60"
      }`}
    >
      {label}
    </button>
  );
}

function ToolButton({ label, title, onClick, disabled }: { label: string; title?: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="h-[24px] px-2 rounded-md text-[11px] font-medium text-text-secondary bg-bg-input border border-border-subtle hover:text-text hover:border-accent/40 transition-colors duration-150 cursor-pointer disabled:opacity-30 disabled:cursor-default"
    >
      {label}
    </button>
  );
}

function Divider() {
  return <span className="w-px h-4 bg-border-subtle/60 mx-0.5 shrink-0" />;
}

function Chip({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium shrink-0 whitespace-nowrap"
      style={{ background: `color-mix(in srgb, ${color} 13%, transparent)`, color }}
    >
      <span className="font-bold tabular-nums">{value.toLocaleString()}</span>
      <span className="opacity-75">{label}</span>
    </span>
  );
}

const inputClass =
  "h-[26px] rounded-md px-2.5 text-[12px] font-mono bg-bg-input text-text border border-border-subtle outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/40 placeholder:text-text-faint";

/* ── Main Viewer ── */

function TextFinderView({
  data,
  input,
  onInputChange,
}: {
  data: string;
  theme: "dark" | "light";
  input?: string;
  onInputChange?: (value: string) => void;
}) {
  // Prefer the live editor input so Replace can round-trip; falls back to the
  // transform output (identical for this pass-through transform).
  const text = input ?? data ?? "";

  const [query, setQuery] = useState("");
  const [regex, setRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [replacement, setReplacement] = useState("");
  const [grep, setGrep] = useState(false);
  const [wrap, setWrap] = useState(true);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState<"matches" | "lines" | null>(null);

  const baseFont = useSettingsStore((s) => s.fontSize);
  const [fontSize, setFontSize] = useState(baseFont);

  const options: SearchOptions = useMemo(
    () => ({ query, regex, caseSensitive, wholeWord }),
    [query, regex, caseSensitive, wholeWord],
  );

  const { matches, error } = useMemo(() => search(text, options), [text, options]);

  const lines = useMemo(() => text.split("\n"), [text]);

  // line index -> matches on that line, each tagged with its global nav index.
  const lineMatches = useMemo(() => {
    const map = new Map<number, (Match & { index: number })[]>();
    matches.forEach((m, index) => {
      const list = map.get(m.line);
      if (list) list.push({ ...m, index });
      else map.set(m.line, [{ ...m, index }]);
    });
    return map;
  }, [matches]);

  const matchedLines = useMemo(() => {
    const sorted = [...lineMatches.keys()].sort((a, b) => a - b);
    return sorted;
  }, [lineMatches]);

  const visibleLines = useMemo(
    () => (grep ? matchedLines : lines.map((_, i) => i)),
    [grep, matchedLines, lines],
  );

  const renderedLines = visibleLines.slice(0, MAX_RENDER_LINES);
  const truncated = visibleLines.length > MAX_RENDER_LINES;

  // Keep the active match in range and scrolled into view as it moves.
  const activeRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    setActiveIndex((i) => (matches.length === 0 ? 0 : Math.min(i, matches.length - 1)));
  }, [matches.length]);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeIndex, matches]);

  const go = (delta: number) => {
    if (matches.length === 0) return;
    setActiveIndex((i) => (i + delta + matches.length) % matches.length);
  };

  const copy = async (kind: "matches" | "lines") => {
    const value =
      kind === "matches"
        ? matches.map((m) => m.text).join("\n")
        : matchedLines.map((i) => lines[i]).join("\n");
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1200);
  };

  const replaceCurrent = () => {
    const m = matches[activeIndex];
    if (!onInputChange || !m) return;
    onInputChange(replaceSpan(text, m, replacement));
  };

  const replaceEvery = () => {
    if (!onInputChange || matches.length === 0) return;
    onInputChange(replaceAll(text, options, replacement));
  };

  const lineHeightPx = Math.round(fontSize * 1.6);
  const gutterDigits = String(lines.length).length;
  const activeLine = matches[activeIndex]?.line;

  function renderLine(lineText: string, lineIdx: number): ReactNode {
    const ms = lineMatches.get(lineIdx);
    if (!ms || ms.length === 0) return lineText || " ";

    const parts: ReactNode[] = [];
    let cursor = 0;
    ms.forEach((m, k) => {
      const start = Math.max(cursor, Math.min(m.colStart, lineText.length));
      const end = Math.max(start, Math.min(m.colEnd, lineText.length));
      if (start > cursor) parts.push(lineText.slice(cursor, start));
      const isActive = m.index === activeIndex;
      parts.push(
        <span
          key={k}
          ref={isActive ? activeRef : undefined}
          className="rounded-[2px] box-decoration-clone px-[1px]"
          style={
            isActive
              ? { background: ACTIVE_BG, color: "#1a1300", boxShadow: `0 0 0 1.5px ${ACTIVE_BG}` }
              : { background: MATCH_BG }
          }
        >
          {lineText.slice(start, end)}
        </span>,
      );
      cursor = end;
    });
    if (cursor < lineText.length) parts.push(lineText.slice(cursor));
    return parts;
  }

  /* ── Render ── */

  if (!text.trim()) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 select-none">
        <div
          className="flex items-center justify-center w-12 h-12 rounded-2xl"
          style={{ background: `color-mix(in srgb, ${ACTIVE_BG} 12%, transparent)`, color: ACTIVE_BG, transform: "scale(1.3)" }}
        >
          <HighlightIcon />
        </div>
        <p className="text-[13px] text-text-faint">Paste or type text, then search to highlight matches</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Find row */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border-subtle/50 bg-bg-secondary/20 shrink-0">
        <span className="text-text-faint shrink-0 pl-0.5">
          <SearchIcon />
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              go(e.shiftKey ? -1 : 1);
            }
          }}
          placeholder="Find…"
          spellCheck={false}
          autoFocus
          className={`${inputClass} flex-1 min-w-0`}
        />

        <TogglePill label=".*" title="Regular expression" active={regex} onClick={() => setRegex((v) => !v)} />
        <TogglePill label="Aa" title="Case sensitive" active={caseSensitive} onClick={() => setCaseSensitive((v) => !v)} />
        <TogglePill label="\b" title="Whole word" active={wholeWord} onClick={() => setWholeWord((v) => !v)} />

        <Divider />

        <span className="text-[11px] tabular-nums w-[58px] text-right shrink-0">
          {error ? (
            <span className="text-[#f87171]" title={error}>
              bad regex
            </span>
          ) : query ? (
            <span className="tabular-nums">
              <span className={matches.length ? "font-semibold" : "text-text-faint"} style={{ color: matches.length ? ACTIVE_BG : undefined }}>
                {matches.length ? activeIndex + 1 : 0}
              </span>
              <span className="text-text-faint">/{matches.length}</span>
            </span>
          ) : null}
        </span>

        <IconButton tooltip="Previous match" shortcut="⇧⏎" onClick={() => go(-1)} disabled={!matches.length}>
          <ChevronIcon dir="up" />
        </IconButton>
        <IconButton tooltip="Next match" shortcut="⏎" onClick={() => go(1)} disabled={!matches.length}>
          <ChevronIcon dir="down" />
        </IconButton>
        <IconButton tooltip="Show only matching lines" active={grep} onClick={() => setGrep((v) => !v)}>
          <FilterIcon />
        </IconButton>
      </div>

      {/* Replace + tools row */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border-subtle/50 bg-bg-secondary/10 shrink-0">
        <span className="text-text-faint shrink-0 pl-0.5">
          <ReplaceIcon />
        </span>
        <input
          type="text"
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
          placeholder={onInputChange ? "Replace…" : "Replace unavailable"}
          spellCheck={false}
          disabled={!onInputChange}
          className={`${inputClass} flex-1 min-w-0 disabled:opacity-40`}
        />
        <ToolButton label="Replace" title="Replace the current match" onClick={replaceCurrent} disabled={!onInputChange || !matches.length} />
        <ToolButton label="All" title="Replace all matches" onClick={replaceEvery} disabled={!onInputChange || !matches.length} />

        <Divider />

        <ToolButton
          label={copied === "matches" ? "Copied" : "Copy matches"}
          title="Copy every matched substring"
          onClick={() => copy("matches")}
          disabled={!matches.length}
        />
        <ToolButton
          label={copied === "lines" ? "Copied" : "Copy lines"}
          title="Copy every line that contains a match"
          onClick={() => copy("lines")}
          disabled={!matches.length}
        />

        <div className="ml-auto flex items-center gap-1 shrink-0">
          <IconButton tooltip={wrap ? "Disable word wrap" : "Enable word wrap"} active={wrap} onClick={() => setWrap((v) => !v)}>
            <WrapIcon />
          </IconButton>
          <IconButton tooltip="Toggle line numbers" active={showLineNumbers} onClick={() => setShowLineNumbers((v) => !v)}>
            <HashIcon />
          </IconButton>
          <Divider />
          <IconButton tooltip="Smaller text" onClick={() => setFontSize((f) => Math.max(MIN_FONT, f - 1))} disabled={fontSize <= MIN_FONT}>
            <span className="text-[11px] font-semibold">A−</span>
          </IconButton>
          <span className="text-[10.5px] tabular-nums text-text-faint w-[18px] text-center select-none">{fontSize}</span>
          <IconButton tooltip="Larger text" onClick={() => setFontSize((f) => Math.min(MAX_FONT, f + 1))} disabled={fontSize >= MAX_FONT}>
            <span className="text-[13px] font-semibold">A+</span>
          </IconButton>
        </div>
      </div>

      {/* Content */}
      {grep && matches.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-text-faint text-[12.5px] select-none">
          {query ? "No lines match" : "Type a search to filter lines"}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="font-mono py-1" style={{ fontSize, lineHeight: `${lineHeightPx}px`, width: wrap ? undefined : "max-content", minWidth: "100%" }}>
            {renderedLines.map((lineIdx) => {
              const isMatched = lineMatches.has(lineIdx);
              const isActiveLine = lineIdx === activeLine;
              return (
                <div
                  key={lineIdx}
                  className={`flex transition-colors duration-100 ${isMatched ? "" : "hover:bg-bg-hover/25"}`}
                  style={{
                    minHeight: lineHeightPx,
                    background: isMatched
                      ? isActiveLine
                        ? "color-mix(in srgb, #f59e0b 13%, transparent)"
                        : "color-mix(in srgb, #facc15 7%, transparent)"
                      : undefined,
                    boxShadow: isMatched
                      ? `inset 2px 0 0 ${isActiveLine ? ACTIVE_BG : "color-mix(in srgb, #facc15 55%, transparent)"}`
                      : undefined,
                  }}
                >
                  {showLineNumbers && (
                    <span
                      className={`shrink-0 select-none text-right pr-3 pl-3 tabular-nums ${isMatched ? "font-semibold" : "text-text-faint/55"}`}
                      style={{
                        minWidth: `calc(${gutterDigits}ch + 1.5rem)`,
                        color: isActiveLine ? ACTIVE_BG : isMatched ? "#eab308" : undefined,
                      }}
                    >
                      {lineIdx + 1}
                    </span>
                  )}
                  <span className={`text-text ${wrap ? "whitespace-pre-wrap break-words min-w-0" : "whitespace-pre"} pr-3`}>
                    {renderLine(lines[lineIdx] ?? "", lineIdx)}
                  </span>
                </div>
              );
            })}
            {truncated && (
              <div className="px-3 py-2 text-[11.5px] text-text-faint select-none">
                Showing first {MAX_RENDER_LINES.toLocaleString()} of {visibleLines.length.toLocaleString()} lines — turn on the filter to narrow down.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center gap-2 px-3 h-[28px] border-t border-border-subtle/50 bg-bg-secondary/20 shrink-0 text-[10.5px] overflow-x-auto select-none">
        {query && !error ? (
          <>
            <Chip value={matches.length} label={matches.length === 1 ? "match" : "matches"} color="#f59e0b" />
            <Chip value={matchedLines.length} label="lines hit" color="#34d399" />
            <Chip value={lines.length} label="total" color="#60a5fa" />
            {grep && <Chip value={visibleLines.length} label="shown" color="#a78bfa" />}
            {matches.length > 0 && (
              <span className="ml-auto shrink-0 text-text-faint tabular-nums">
                on match <span className="font-semibold" style={{ color: ACTIVE_BG }}>{activeIndex + 1}</span> / {matches.length}
              </span>
            )}
          </>
        ) : (
          <>
            <Chip value={lines.length} label={lines.length === 1 ? "line" : "lines"} color="#60a5fa" />
            <Chip value={text.length} label="chars" color="#4d9fff" />
            <span className="ml-auto shrink-0 text-text-faint">type to search</span>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Register ── */

registerOutputView({
  id: "text-finder",
  name: "Find & Highlight",
  icon: HighlightIcon,
  parse: (output: string) => output,
  component: TextFinderView,
});
