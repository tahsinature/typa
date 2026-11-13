import { useEffect, useState } from "react";
import type { Table } from "@tanstack/react-table";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { getVisibleData } from "./table-data";
import { copyTable, type TableCopyFormat, type TableCopyResult } from "./table-copy";

const COPY_FORMATS: { format: TableCopyFormat; label: string }[] = [
  { format: "tsv", label: "Copy for Excel" },
  { format: "csv", label: "Copy as CSV" },
  { format: "markdown", label: "Copy as Markdown" },
  { format: "html", label: "Copy as rich-text table" },
  { format: "json", label: "Copy as JSON" },
];

export function CopyMenu({ table }: { table: Table<Record<string, unknown>> }) {
  const [status, setStatus] = useState<TableCopyResult | "idle" | "error">("idle");
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (status === "idle") return;
    const timer = setTimeout(() => setStatus("idle"), 2500);
    return () => clearTimeout(timer);
  }, [status]);

  const copyAs = async (format: TableCopyFormat) => {
    setStatus("idle");
    setCopying(true);
    try {
      const { cols, rows } = getVisibleData(table);
      setStatus(await copyTable(cols, rows, format));
    } catch {
      setStatus("error");
    } finally {
      setCopying(false);
    }
  };

  const message = status === "error" ? "Couldn't copy table. Try again."
    : status === "plain-text" ? "Copied as plain text. Rich text is unavailable."
    : status === "copied" ? "Table copied" : "Copy table";
  const copied = status === "copied" || status === "plain-text";

  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={copying}
            className="flex items-center justify-center size-[28px] rounded-md text-text-faint hover:text-text-muted hover:bg-bg-hover/50 transition-colors disabled:opacity-50"
            title={message}
            aria-label="Copy table"
          >
            {copied ? (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="5" y="5" width="8" height="8" rx="1.5" />
                <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
              </svg>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            {COPY_FORMATS.map(({ format, label }) => (
              <DropdownMenuItem key={format} onClick={() => copyAs(format)}>
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {status !== "idle" && (
        <div role="status" className="absolute right-0 top-full mt-1 rounded-md border border-border-subtle bg-bg-elevated px-2 py-1 text-[11px] text-text-secondary whitespace-nowrap shadow-sm">
          {message}
        </div>
      )}
    </div>
  );
}
