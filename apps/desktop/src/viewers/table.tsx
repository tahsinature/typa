import { useMemo } from "react";
import { TableIcon } from "@/components/Icons";
import { registerViewer } from "./registry";

interface TableData {
  columns: string[];
  rows: Record<string, unknown>[];
}

function extractTableData(data: unknown): TableData | null {
  // Array of objects → columns from keys, rows from values
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object" && data[0] !== null) {
    const columns = [...new Set(data.flatMap((row) => Object.keys(row as object)))];
    return { columns, rows: data as Record<string, unknown>[] };
  }

  // Single object → two-column key/value table
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    const entries = Object.entries(data);
    if (entries.length === 0) return null;
    return {
      columns: ["Key", "Value"],
      rows: entries.map(([k, v]) => ({ Key: k, Value: v })),
    };
  }

  // Array of primitives → single-column table
  if (Array.isArray(data) && data.length > 0) {
    return {
      columns: ["Value"],
      rows: data.map((v) => ({ Value: v })),
    };
  }

  return null;
}

function formatCell(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function TableViewer({ data, theme }: { data: unknown; theme: "dark" | "light" }) {
  const table = useMemo(() => extractTableData(data), [data]);

  if (!table) {
    return <div className="p-3 text-text-muted text-[13px]">Cannot render as table</div>;
  }

  const isDark = theme === "dark";

  return (
    <div className="h-full overflow-auto" style={{ backgroundColor: "var(--bg)" }}>
      <table className="w-full border-collapse text-[13px]" style={{ fontFamily: "'SF Mono', 'Fira Code', monospace" }}>
        <thead>
          <tr>
            {table.columns.map((col) => (
              <th
                key={col}
                className="text-left px-3 py-1.5 font-medium sticky top-0"
                style={{
                  backgroundColor: isDark ? "#282a2f" : "#f5f5f5",
                  borderBottom: `1px solid ${isDark ? "#3c3c3c" : "#d1d1d6"}`,
                  color: isDark ? "#a0a0a0" : "#636366",
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr
              key={i}
              className="transition-colors"
              style={{
                backgroundColor: i % 2 === 0 ? "transparent" : isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
              }}
            >
              {table.columns.map((col) => (
                <td
                  key={col}
                  className="px-3 py-1.5"
                  style={{ borderBottom: `1px solid ${isDark ? "#2d2d30" : "#e5e5ea"}` }}
                >
                  {formatCell(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

registerViewer({
  id: "table",
  name: "Table View",
  icon: TableIcon,
  component: TableViewer,
});
