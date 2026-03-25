import { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
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
import { registerOutputView } from "./registry";

/* ── Types ── */

interface PortInfo {
  pid: number;
  name: string;
  port: number;
  protocol: string;
  state: string;
  local_address: string;
  remote_address: string;
  command: string;
  memory_bytes: number;
}

/* ── Helpers ── */

function formatMemory(bytes: number): string {
  if (bytes === 0) return "\u2014";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function normalizeState(state: string): string {
  const s = state.toUpperCase().replace(/[^A-Z_]/g, "");
  const map: Record<string, string> = {
    LISTEN: "LISTEN", LISTENING: "LISTEN",
    ESTABLISHED: "ESTABLISHED", ESTAB: "ESTABLISHED",
    CLOSE_WAIT: "CLOSE_WAIT", CLOSEWAIT: "CLOSE_WAIT",
    TIME_WAIT: "TIME_WAIT", TIMEWAIT: "TIME_WAIT",
    FIN_WAIT_1: "FIN_WAIT", FIN_WAIT_2: "FIN_WAIT",
    FINWAIT1: "FIN_WAIT", FINWAIT2: "FIN_WAIT",
    SYN_SENT: "SYN_SENT", SYN_RECV: "SYN_RECV",
    LAST_ACK: "LAST_ACK", CLOSING: "CLOSING",
  };
  return map[s] || s || "UNKNOWN";
}

const STATE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  LISTEN: { bg: "rgba(52, 208, 88, 0.08)", text: "#34d058", dot: "#34d058" },
  ESTABLISHED: { bg: "rgba(77, 159, 255, 0.08)", text: "#4d9fff", dot: "#4d9fff" },
  CLOSE_WAIT: { bg: "rgba(248, 81, 73, 0.08)", text: "#f85149", dot: "#f85149" },
  TIME_WAIT: { bg: "rgba(251, 191, 36, 0.08)", text: "#fbbf24", dot: "#fbbf24" },
  FIN_WAIT: { bg: "rgba(251, 146, 60, 0.08)", text: "#fb923c", dot: "#fb923c" },
  SYN_SENT: { bg: "rgba(168, 85, 247, 0.08)", text: "#a855f7", dot: "#a855f7" },
  SYN_RECV: { bg: "rgba(168, 85, 247, 0.08)", text: "#a855f7", dot: "#a855f7" },
  UNKNOWN: { bg: "rgba(110, 110, 115, 0.08)", text: "#6e6e73", dot: "#6e6e73" },
};

function deduplicatePorts(arr: PortInfo[]): PortInfo[] {
  const seen = new Set<string>();
  return arr.filter((p) => {
    const key = `${p.pid}-${p.port}-${p.protocol}-${normalizeState(p.state)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ── State Badge ── */

function StateBadge({ state }: { state: string }) {
  const normalized = normalizeState(state);
  const color = STATE_COLORS[normalized] || STATE_COLORS.UNKNOWN;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-semibold uppercase tracking-wider whitespace-nowrap"
      style={{ background: color.bg, color: color.text }}
    >
      <span className="size-1.5 rounded-full" style={{ background: color.dot }} />
      {normalized}
    </span>
  );
}

/* ── Icons ── */

function SearchIcon() {
  return (
    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7" cy="7" r="5" /><path d="M11 11L14 14" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function PortTableIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}

/* ── Row Actions Menu ── */

function RowActionsMenu({ port, onRefresh }: { port: PortInfo; onRefresh: () => void }) {
  const handleKill = async () => {
    await invoke("kill_process", { pid: port.pid });
    setTimeout(onRefresh, 500);
  };

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
        <DropdownMenuLabel>Copy</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(String(port.pid))}>
          Copy PID
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(port.command || port.name)}>
          Copy Command
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(port.local_address)}>
          Copy Address
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleKill} className="text-danger focus:text-danger">
          Kill Process
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── Self-contained Port Table ── */

function PortTableView() {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [query, setQuery] = useState("");

  const fetchPorts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<PortInfo[]>("scan_ports");
      setPorts(deduplicatePorts(result));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPorts();
  }, [fetchPorts]);

  const columns = useMemo<ColumnDef<PortInfo>[]>(
    () => [
      {
        accessorKey: "port",
        header: ({ column }) => (
          <button className="inline-flex items-center gap-1 hover:text-text transition-colors" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Port
            <span className="opacity-40">{column.getIsSorted() === "asc" ? "\u2191" : column.getIsSorted() === "desc" ? "\u2193" : "\u21C5"}</span>
          </button>
        ),
        cell: ({ getValue }) => (
          <span className="font-mono font-bold text-accent">:{getValue<number>()}</span>
        ),
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <button className="inline-flex items-center gap-1 hover:text-text transition-colors" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Process
            <span className="opacity-40">{column.getIsSorted() === "asc" ? "\u2191" : column.getIsSorted() === "desc" ? "\u2193" : "\u21C5"}</span>
          </button>
        ),
        cell: ({ getValue }) => (
          <span className="font-medium">{getValue<string>() || "Unknown"}</span>
        ),
      },
      {
        accessorKey: "pid",
        header: "PID",
        cell: ({ getValue }) => (
          <span className="font-mono text-text-secondary">{getValue<number>()}</span>
        ),
      },
      {
        accessorKey: "state",
        header: "State",
        cell: ({ getValue }) => <StateBadge state={getValue<string>()} />,
      },
      {
        accessorKey: "protocol",
        header: "Proto",
        cell: ({ getValue }) => (
          <span className="font-mono text-text-secondary text-[11px]">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "local_address",
        header: "Address",
        cell: ({ getValue }) => (
          <span className="font-mono text-text-secondary text-[11px]">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "memory_bytes",
        header: ({ column }) => (
          <button className="inline-flex items-center gap-1 hover:text-text transition-colors" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Memory
            <span className="opacity-40">{column.getIsSorted() === "asc" ? "\u2191" : column.getIsSorted() === "desc" ? "\u2193" : "\u21C5"}</span>
          </button>
        ),
        cell: ({ getValue }) => (
          <span className="font-mono text-text-secondary text-[11px]">
            {formatMemory(getValue<number>())}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => <RowActionsMenu port={row.original} onRefresh={fetchPorts} />,
        enableHiding: false,
        enableSorting: false,
        size: 40,
      },
    ],
    [fetchPorts],
  );

  const table = useReactTable({
    data: ports,
    columns,
    state: { sorting, columnVisibility, globalFilter: query },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const q = String(filterValue).toLowerCase();
      if (!q) return true;
      const p = row.original;
      const isNumeric = /^\d+$/.test(q);
      if (isNumeric) {
        return p.port.toString().startsWith(q) || p.pid.toString() === q;
      }
      return (
        p.name.toLowerCase().includes(q) ||
        p.protocol.toLowerCase().includes(q) ||
        normalizeState(p.state).toLowerCase().includes(q)
      );
    },
  });

  if (loading && ports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 select-none">
        <div className="size-8 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
        <p className="text-[12px] text-text-faint/60">Scanning ports...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 select-none">
        <p className="text-[12px] text-danger/80">{error}</p>
        <button onClick={fetchPorts} className="text-[11px] text-accent hover:underline">Try again</button>
      </div>
    );
  }

  const visibleCount = table.getFilteredRowModel().rows.length;

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
            placeholder="Filter by port, name, PID, state..."
            className="w-full h-[30px] rounded-md pl-8 pr-2.5 text-[12px] bg-bg-input text-text border border-border-subtle outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/40 placeholder:text-text-faint"
          />
        </div>
        <button onClick={fetchPorts} disabled={loading} title="Refresh"
          className="flex items-center justify-center size-[28px] rounded-md text-text-faint hover:text-text hover:bg-bg-hover/50 transition-colors disabled:opacity-40">
          <span className={loading ? "animate-spin" : ""}><RefreshIcon /></span>
        </button>
      </div>

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
        {query ? `${visibleCount} of ${ports.length} port(s)` : `${ports.length} port(s)`}
      </div>
    </div>
  );
}

/* ── Register ── */

registerOutputView({
  id: "port-table",
  name: "Port Table",
  icon: PortTableIcon,
  parse: (output: string) => output,
  component: PortTableView,
});
