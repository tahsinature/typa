import { useState, useRef, useEffect } from "react";
import type { Table as ReactTable } from "@tanstack/react-table";

export function ColumnsPopover({ table }: { table: ReactTable<Record<string, unknown>> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center w-[28px] h-[28px] rounded-md text-text-faint hover:text-text-muted hover:bg-bg-hover/50 transition-colors"
        title="Toggle columns"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <rect x="2" y="2" width="4" height="12" rx="1" /><rect x="10" y="2" width="4" height="12" rx="1" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-[32px] z-50 min-w-[140px] rounded-lg border border-border-subtle bg-bg-elevated p-1 shadow-lg animate-in fade-in-0 zoom-in-95">
          {table.getAllColumns().filter((c) => c.getCanHide()).map((col) => (
            <button
              key={col.id}
              onClick={() => col.toggleVisibility(!col.getIsVisible())}
              className="flex items-center gap-2 w-full px-2 py-1 rounded-md text-[11px] text-text-secondary hover:bg-bg-hover transition-colors"
            >
              <span className={`w-[12px] h-[12px] rounded-sm border text-[9px] flex items-center justify-center ${col.getIsVisible() ? "bg-accent border-accent text-white" : "border-border"}`}>
                {col.getIsVisible() && "\u2713"}
              </span>
              {col.id}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Filter chips ── */

export function FilterChips({ filters, onRemove }: { filters: Record<string, string>; onRemove: (col: string) => void }) {
  const entries = Object.entries(filters);
  if (entries.length === 0) return null;
  return (
    <div className="flex items-center gap-1 px-3 pb-1.5 flex-wrap">
      {entries.map(([col, val]) => (
        <span key={col} className="inline-flex items-center gap-1 h-[20px] px-2 rounded-full bg-accent/10 text-accent text-[10px] font-medium">
          {col}:{val}
          <button aria-label={`Remove ${col} filter`} onClick={() => onRemove(col)} className="hover:text-accent-hover ml-0.5">{"\u00d7"}</button>
        </span>
      ))}
    </div>
  );
}

export function SearchIcon() {
  return (
    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7" cy="7" r="5" /><path d="M11 11L14 14" />
    </svg>
  );
}
