import type { Table as ReactTable } from "@tanstack/react-table";

export interface TableData {
  columns: string[];
  rows: Record<string, unknown>[];
}

export function extractTableData(data: unknown): TableData | null {
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object" && data[0] !== null) {
    const columns = [...new Set(data.flatMap((row) => Object.keys(row as object)))];
    return { columns, rows: data as Record<string, unknown>[] };
  }
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    const entries = Object.entries(data);
    if (entries.length === 0) return null;
    return { columns: ["Key", "Value"], rows: entries.map(([k, v]) => ({ Key: k, Value: v })) };
  }
  if (Array.isArray(data) && data.length > 0) {
    return { columns: ["Value"], rows: data.map((v) => ({ Value: v })) };
  }
  return null;
}

export function formatCell(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/* ── Smart search: supports "column:value" or plain global search ── */

export function parseQuery(query: string, columns: string[]): { global: string; columnFilters: Record<string, string> } {
  const filters: Record<string, string> = {};
  let global = query;

  const colSet = new Set(columns.map((c) => c.toLowerCase()));
  const parts = query.match(/(\w+):(\S+)/g);
  if (parts) {
    for (const part of parts) {
      const [key, ...rest] = part.split(":");
      const val = rest.join(":");
      if (colSet.has(key.toLowerCase())) {
        const realCol = columns.find((c) => c.toLowerCase() === key.toLowerCase())!;
        filters[realCol] = val;
        global = global.replace(part, "").trim();
      }
    }
  }

  return { global, columnFilters: filters };
}

/** Quote delimiters, quotes and line breaks for spreadsheet clipboard formats. */
export function serializeTable(columns: string[], rows: string[][], format: "csv" | "tsv"): string {
  const separator = format === "csv" ? "," : "\t";
  const escape = (value: string) =>
    [separator, '"', "\n", "\r"].some((character) => value.includes(character))
      ? `"${value.replace(/"/g, '""')}"`
      : value;
  return [columns, ...rows].map((row) => row.map(escape).join(separator)).join("\n");
}

export function getVisibleData(reactTable: ReactTable<Record<string, unknown>>) {
  const cols = reactTable.getVisibleLeafColumns().map(c => c.id).filter(id => id !== "_actions");
  const rows = reactTable.getRowModel().rows.map(row =>
    cols.map(col => {
      const val = row.getValue(col);
      return val === null || val === undefined ? "" : formatCell(val);
    })
  );
  return { cols, rows };
}
