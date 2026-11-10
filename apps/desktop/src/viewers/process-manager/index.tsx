import { useMemo, useState } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { registerOutputView } from "../registry";
import { TerminateDialog, type TerminationTarget } from "./terminate-dialog";
import { formatProcessMemory, useProcesses } from "./use-processes";

type SortKey = "name" | "pid" | "memory_bytes" | "command";
const columns: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "pid", label: "PID" },
  { key: "memory_bytes", label: "Memory" },
  { key: "command", label: "Command" },
];

function ProcessIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="3" />
      <path d="M9 9h6v6H9zM9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3" />
    </svg>
  );
}

function ProcessManager() {
  const { processes, can_stop: canStop, loading, error, refresh } = useProcesses();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({ key: "memory_bytes", descending: true });
  const [target, setTarget] = useState<TerminationTarget | null>(null);
  const [message, setMessage] = useState("");

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return processes.filter((process) => !search ||
      String(process.pid) === search || process.name.toLowerCase().includes(search) ||
      process.command.toLowerCase().includes(search)
    ).sort((left, right) => {
      const a = left[sort.key];
      const b = right[sort.key];
      const comparison = typeof a === "number" && typeof b === "number"
        ? a - b : String(a).localeCompare(String(b));
      return (sort.descending ? -comparison : comparison) || left.pid - right.pid;
    });
  }, [processes, query, sort]);

  function sortBy(key: SortKey) {
    setSort((current) => ({ key, descending: current.key === key ? !current.descending : key === "memory_bytes" }));
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border-subtle/50">
        <input aria-label="Search processes" placeholder="Filter by name, PID, or command…"
          value={query} onChange={(event) => setQuery(event.target.value)}
          className="flex-1 min-w-0 h-[30px] rounded-md px-3 text-xs bg-bg-input text-text border border-border-subtle outline-none focus:ring-1 focus:ring-accent/40 placeholder:text-text-faint" />
        <span className="text-[11px] text-text-secondary whitespace-nowrap">
          {query ? `${filtered.length} of ${processes.length}` : processes.length} processes
        </span>
        <IconButton tooltip="Refresh processes" aria-label="Refresh processes" disabled={loading} onClick={() => { setMessage(""); void refresh(); }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M21 3v6h-6M3 21v-6h6M20 9a8 8 0 0 0-14-4L3 9m18 6-3 4a8 8 0 0 1-14-4" />
          </svg>
        </IconButton>
      </div>
      {error && <p role="alert" className="px-3 py-2 text-xs text-danger">{error} Use Refresh to try again.</p>}
      {message && <p role="status" className="px-3 py-2 text-xs text-text-secondary">{message}</p>}
      {!canStop && processes.length > 0 && (
        <p className="px-3 py-2 text-xs text-text-muted">Normal stop is unavailable on this platform. Force Kill terminates a process immediately.</p>
      )}
      <div className="flex-1 min-h-0 overflow-auto p-3" aria-busy={loading}>
        <div className="rounded-lg border border-border-subtle overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map(({ key, label }) => (
                  <TableHead key={key} className="bg-bg-secondary" aria-sort={sort.key === key ? (sort.descending ? "descending" : "ascending") : "none"}>
                    <button className="inline-flex items-center gap-1 hover:text-text focus-visible:outline-accent" onClick={() => sortBy(key)}>
                      {label}<span aria-hidden="true">{sort.key === key ? (sort.descending ? "↓" : "↑") : "↕"}</span>
                    </button>
                  </TableHead>
                ))}
                <TableHead className="bg-bg-secondary">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((process) => (
                <TableRow key={`${process.pid}-${process.start_time}`}>
                  <TableCell><span className="block max-w-56 truncate font-medium text-text" title={process.name}>{process.name || "Unknown"}</span></TableCell>
                  <TableCell className="font-mono text-accent tabular-nums">{process.pid}</TableCell>
                  <TableCell className="font-mono text-text-secondary whitespace-nowrap tabular-nums">{formatProcessMemory(process.memory_bytes)}</TableCell>
                  <TableCell><span className="block max-w-96 truncate font-mono text-[11px] text-text-faint" title={process.command}>{process.command || "Unavailable"}</span></TableCell>
                  <TableCell>
                    {process.protected ? <span className="text-[11px] text-text-muted">Protected</span> : (
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <button disabled={!canStop} onClick={() => setTarget({ process, force: false })}
                          aria-label={`Stop ${process.name}, PID ${process.pid}`}
                          className="rounded px-2 py-1 text-[11px] text-text-secondary hover:bg-bg-hover focus-visible:outline-accent disabled:opacity-40">Stop</button>
                        <button onClick={() => setTarget({ process, force: true })}
                          aria-label={`Force kill ${process.name}, PID ${process.pid}`}
                          className="rounded px-2 py-1 text-[11px] text-danger hover:bg-danger/10 focus-visible:outline-accent">Force Kill</button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!filtered.length && (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-text-muted">
                  {loading ? "Scanning processes…" : query ? "No matching processes" : "No processes available"}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      {target && <TerminateDialog target={target} onClose={() => setTarget(null)} onSent={(notice) => {
        setMessage(notice);
        setTarget(null);
        void refresh();
      }} />}
    </div>
  );
}

registerOutputView({
  id: "process-manager",
  name: "Processes",
  icon: ProcessIcon,
  parse: (output: string) => output,
  component: ProcessManager,
});
