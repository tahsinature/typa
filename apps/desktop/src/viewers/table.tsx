import { useMemo, useState, useRef, useEffect, useCallback, type ComponentType } from "react";
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { TableIcon } from "@/components/Icons";
import { registerOutputView } from "./registry";

/* ── Row Action Types ── */

export interface RowAction {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  variant?: "default" | "danger";
  action: (row: Record<string, unknown>) => void | Promise<void>;
}

export interface RowActionGroup {
  label?: string;
  actions: RowAction[];
}

export type RowActionsConfig = (row: Record<string, unknown>) => RowActionGroup[];

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

function FilterChips({ filters, onRemove }: { filters: Record<string, string>; onRemove: (col: string) => void }) {
  const entries = Object.entries(filters);
  if (entries.length === 0) return null;
  return (
    <div className="flex items-center gap-1 px-3 pb-1.5 flex-wrap">
      {entries.map(([col, val]) => (
        <span key={col} className="inline-flex items-center gap-1 h-[20px] px-2 rounded-full bg-accent/10 text-accent text-[10px] font-medium">
          {col}:{val}
          <button onClick={() => onRemove(col)} className="hover:text-accent-hover ml-0.5">\u00d7</button>
        </span>
      ))}
    </div>
  );
}

/* ── Row Actions Menu ── */

function RowActionsMenu({ row, groups }: { row: Record<string, unknown>; groups: RowActionGroup[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center justify-center size-6 rounded-md text-text-faint hover:text-text-secondary hover:bg-bg-hover transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {groups.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && <DropdownMenuSeparator />}
            {group.label && <DropdownMenuLabel>{group.label}</DropdownMenuLabel>}
            {group.actions.map((action) => (
              <DropdownMenuItem
                key={action.label}
                onClick={() => action.action(row)}
                className={action.variant === "danger" ? "text-danger focus:text-danger" : ""}
              >
                {action.icon && (
                  <action.icon className="mr-2 size-3.5" />
                )}
                {action.label}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── Copy menu (TSV / CSV) ── */

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function getVisibleData(reactTable: ReturnType<typeof useReactTable<Record<string, unknown>>>) {
  const cols = reactTable.getVisibleLeafColumns().map(c => c.id).filter(id => id !== "_actions");
  const rows = reactTable.getFilteredRowModel().rows.map(row =>
    cols.map(col => {
      const val = row.original[col];
      return val === null || val === undefined ? "" : String(val);
    })
  );
  return { cols, rows };
}

function CopyMenu({ table: reactTable }: { table: ReturnType<typeof useReactTable<Record<string, unknown>>> }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyAs = useCallback((format: "tsv" | "csv") => {
    const { cols, rows } = getVisibleData(reactTable);
    const sep = format === "tsv" ? "\t" : ",";
    const formatCell = format === "csv" ? escapeCSV : (v: string) => v;

    const header = cols.map(formatCell).join(sep);
    const dataRows = rows.map(r => r.map(formatCell).join(sep));
    const text = [header, ...dataRows].join("\n");

    navigator.clipboard.writeText(text).then(() => {
      setCopied(format);
      setTimeout(() => setCopied(null), 1500);
    });
  }, [reactTable]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center justify-center w-[28px] h-[28px] rounded-md text-text-faint hover:text-text-muted hover:bg-bg-hover/50 transition-colors"
          title="Copy table"
        >
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="5" width="8" height="8" rx="1.5" />
              <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
            </svg>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => copyAs("tsv")}>
          Copy for Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => copyAs("csv")}>
          Copy as CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── Viewer ── */

function TableViewer({ data, rowActions }: { data: unknown; theme?: "dark" | "light"; rowActions?: RowActionsConfig }) {
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

    const dataCols: ColumnDef<Record<string, unknown>>[] = tableData.columns.map((col) => ({
      accessorKey: col,
      header: ({ column }) => (
        <button
          className="inline-flex items-center gap-1 hover:text-text transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          {col}
          <span className="opacity-40">
            {column.getIsSorted() === "asc" ? "\u2191" : column.getIsSorted() === "desc" ? "\u2193" : "\u21C5"}
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

    // Append actions column if rowActions configured
    if (rowActions) {
      dataCols.push({
        id: "_actions",
        header: "",
        cell: ({ row }) => {
          const groups = rowActions(row.original);
          if (groups.length === 0) return null;
          return <RowActionsMenu row={row.original} groups={groups} />;
        },
        enableHiding: false,
        enableSorting: false,
        size: 40,
      });
    }

    return dataCols;
  }, [tableData, rowActions]);

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
      {/* Toolbar */}
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
        <CopyMenu table={table} />
        <ColumnsPopover table={table} />
      </div>

      {/* Active filter chips */}
      <FilterChips
        filters={columnFilters}
        onRemove={(col) => {
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

/* ── Factory: create a table view with custom row actions ── */

export function createTableView(config: {
  id: string;
  name: string;
  icon?: ComponentType;
  parse?: (output: string) => unknown;
  rowActions: RowActionsConfig;
}) {
  registerOutputView({
    id: config.id,
    name: config.name,
    icon: config.icon ?? TableIcon,
    parse: config.parse ?? ((output) => JSON.parse(output)),
    component: ({ data, theme }: { data: unknown; theme: "dark" | "light" }) => (
      <TableViewer data={data} theme={theme} rowActions={config.rowActions} />
    ),
  });
}

/* ── Default table registration (no row actions) ── */

registerOutputView({
  parse: (output) => JSON.parse(output),
  id: "table",
  name: "Table View",
  icon: TableIcon,
  component: TableViewer,
});
