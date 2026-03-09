import { useMemo, useState, useRef, useEffect } from "react";
import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableIcon } from "@/components/Icons";
import { registerViewer } from "./registry";

/* ── Data extraction ── */

interface TableData {
  columns: string[];
  rows: Record<string, unknown>[];
}

function extractTableData(data: unknown): TableData | null {
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

function formatCell(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/* ── Smart search: supports "column:value" or plain global search ── */

function parseQuery(query: string, columns: string[]): { global: string; columnFilters: Record<string, string> } {
  const filters: Record<string, string> = {};
  let global = query;

  // Match patterns like status:success or email:ken
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

/* ── Column visibility popover ── */

function ColumnsPopover({ table }: { table: ReturnType<typeof useReactTable<Record<string, unknown>>> }) {
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
                {col.getIsVisible() && "✓"}
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

function FilterChips({ filters, onRemove }: { filters: Record<string, string>; onRemove: (col: string) => void }) {
  const entries = Object.entries(filters);
  if (entries.length === 0) return null;
  return (
    <div className="flex items-center gap-1 px-3 pb-1.5 flex-wrap">
      {entries.map(([col, val]) => (
        <span key={col} className="inline-flex items-center gap-1 h-[20px] px-2 rounded-full bg-accent/10 text-accent text-[10px] font-medium">
          {col}:{val}
          <button onClick={() => onRemove(col)} className="hover:text-accent-hover ml-0.5">×</button>
        </span>
      ))}
    </div>
  );
}

/* ── Viewer ── */

function TableViewer({ data }: { data: unknown }) {
  const tableData = useMemo(() => extractTableData(data), [data]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [query, setQuery] = useState("");

  const { global, columnFilters } = useMemo(
    () => parseQuery(query, tableData?.columns ?? []),
    [query, tableData?.columns],
  );

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    if (!tableData) return [];
    return tableData.columns.map((col) => ({
      accessorKey: col,
      header: ({ column }) => (
        <button
          className="inline-flex items-center gap-1 hover:text-text transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          {col}
          <span className="opacity-40">
            {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "⇅"}
          </span>
        </button>
      ),
      cell: ({ getValue }) => (
        <span style={{ fontFamily: "'SF Mono', 'Fira Code', monospace" }}>
          {formatCell(getValue())}
        </span>
      ),
      filterFn: (row, columnId, filterValue) => {
        return formatCell(row.getValue(columnId)).toLowerCase().includes(String(filterValue).toLowerCase());
      },
    }));
  }, [tableData]);

  // Apply column filters from smart search
  const filteredData = useMemo(() => {
    if (!tableData) return [];
    const entries = Object.entries(columnFilters);
    if (entries.length === 0) return tableData.rows;
    return tableData.rows.filter((row) =>
      entries.every(([col, val]) =>
        formatCell(row[col]).toLowerCase().includes(val.toLowerCase())
      )
    );
  }, [tableData, columnFilters]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, columnVisibility, globalFilter: global },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: () => {},
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = String(filterValue).toLowerCase();
      return row.getAllCells().some((cell) =>
        formatCell(cell.getValue()).toLowerCase().includes(search)
      );
    },
  });

  if (!tableData) {
    return <div className="p-3 text-text-muted text-[13px]">Cannot render as table</div>;
  }

  const visibleCount = table.getFilteredRowModel().rows.length;
  const totalRows = tableData.rows.length;
  const hasFilter = query.length > 0;

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: "var(--bg)" }}>
      {/* Toolbar — one line */}
      <div className="shrink-0 flex items-center gap-1.5 px-3 py-2">
        <div className="relative flex-1">
          <SearchIcon />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or filter with column:value..."
            className="w-full h-[30px] rounded-md pl-8 pr-2.5 text-[12px] bg-bg-input text-text border border-border-subtle outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/40 placeholder:text-text-faint"
          />
        </div>
        <ColumnsPopover table={table} />
      </div>

      {/* Active filter chips */}
      <FilterChips
        filters={columnFilters}
        onRemove={(col) => {
          // Remove the "col:value" part from query
          const regex = new RegExp(`${col}:\\S+\\s*`, "i");
          setQuery((q) => q.replace(regex, "").trim());
        }}
      />

      {/* Table */}
      <div className="flex-1 overflow-auto min-h-0 px-3">
        <div className="rounded-lg border border-border-subtle overflow-hidden">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="hover:bg-transparent">
                  {hg.headers.map((header) => (
                    <TableHead key={header.id} className="bg-bg-secondary">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-16 text-center text-text-muted">
                    No results
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-3 py-1.5 text-[11px] text-text-faint">
        {hasFilter ? `${visibleCount} of ${totalRows} row(s)` : `${totalRows} row(s)`}
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7" cy="7" r="5" /><path d="M11 11L14 14" />
    </svg>
  );
}

registerViewer({
  parse: (output) => JSON.parse(output),
  id: "table",
  name: "Table View",
  icon: TableIcon,
  component: TableViewer,
});
