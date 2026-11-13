import { useMemo, useState, type ReactNode } from "react";
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
import { ColumnsPopover, FilterChips, SearchIcon } from "./TableControls";
import { CopyMenu } from "./CopyMenu";
import { RowActionsMenu, type RowActionsConfig } from "./RowActionsMenu";
import { formatCell, parseQuery, type TableData } from "./table-data";

interface DataTableProps {
  data: TableData;
  rowActions?: RowActionsConfig;
  renderCell?: (column: string, value: unknown, row: Record<string, unknown>) => ReactNode;
  rightAlignedColumns?: string[];
}

export function DataTable({ data: tableData, rowActions, renderCell, rightAlignedColumns }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [query, setQuery] = useState("");

  const { global, columnFilters } = useMemo(
    () => parseQuery(query, tableData.columns),
    [query, tableData.columns],
  );

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    const dataCols: ColumnDef<Record<string, unknown>>[] = tableData.columns.map((col) => ({
      id: col,
      accessorFn: (row) => row[col],
      sortDescFirst: false,
      header: ({ column }) => (
        <button
          className="inline-flex items-center gap-1 hover:text-text transition-colors"
          title="Click to cycle: ascending, descending, original order"
          onClick={() => column.toggleSorting()}
        >
          {col}
          <span className="opacity-40">
            {column.getIsSorted() === "asc" ? "\u2191" : column.getIsSorted() === "desc" ? "\u2193" : "\u21C5"}
          </span>
        </button>
      ),
      cell: ({ getValue, row }) => (
        <span style={{ fontFamily: "'SF Mono', 'Fira Code', monospace" }}>
          {renderCell ? renderCell(col, getValue(), row.original) : formatCell(getValue())}
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
  }, [tableData.columns, rowActions, renderCell]);

  // Apply column filters from smart search
  const filteredData = useMemo(() => {
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

  const visibleCount = table.getFilteredRowModel().rows.length;
  const totalRows = tableData.rows.length;
  const hasFilter = query.length > 0;

  return (
    <div className="h-full min-h-0 flex flex-col" style={{ backgroundColor: "var(--bg)" }}>
      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-1.5 px-3 py-2">
        <div className="relative flex-1">
          <SearchIcon />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search table"
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
                    <TableHead key={header.id} className="bg-bg-secondary" style={{ textAlign: rightAlignedColumns?.includes(header.column.id) ? "right" : "left" }}>
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
                      <TableCell key={cell.id} style={{ textAlign: rightAlignedColumns?.includes(cell.column.id) ? "right" : "left" }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={Math.max(1, table.getVisibleLeafColumns().length)} className="h-16 text-center text-text-muted">
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
