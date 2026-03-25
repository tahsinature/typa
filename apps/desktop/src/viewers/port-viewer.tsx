import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
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
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function normalizeState(state: string): string {
  const s = state.toUpperCase().replace(/[^A-Z_]/g, "");
  const map: Record<string, string> = {
    LISTEN: "LISTEN",
    LISTENING: "LISTEN",
    ESTABLISHED: "ESTABLISHED",
    ESTAB: "ESTABLISHED",
    CLOSE_WAIT: "CLOSE_WAIT",
    CLOSEWAIT: "CLOSE_WAIT",
    TIME_WAIT: "TIME_WAIT",
    TIMEWAIT: "TIME_WAIT",
    FIN_WAIT_1: "FIN_WAIT",
    FIN_WAIT_2: "FIN_WAIT",
    FINWAIT1: "FIN_WAIT",
    FINWAIT2: "FIN_WAIT",
    SYN_SENT: "SYN_SENT",
    SYN_RECV: "SYN_RECV",
    LAST_ACK: "LAST_ACK",
    CLOSING: "CLOSING",
  };
  return map[s] || s || "UNKNOWN";
}

const STATE_COLORS: Record<string, { bg: string; text: string; dot: string }> =
  {
    LISTEN: {
      bg: "rgba(52, 208, 88, 0.08)",
      text: "#34d058",
      dot: "#34d058",
    },
    ESTABLISHED: {
      bg: "rgba(77, 159, 255, 0.08)",
      text: "#4d9fff",
      dot: "#4d9fff",
    },
    CLOSE_WAIT: {
      bg: "rgba(248, 81, 73, 0.08)",
      text: "#f85149",
      dot: "#f85149",
    },
    TIME_WAIT: {
      bg: "rgba(251, 191, 36, 0.08)",
      text: "#fbbf24",
      dot: "#fbbf24",
    },
    FIN_WAIT: {
      bg: "rgba(251, 146, 60, 0.08)",
      text: "#fb923c",
      dot: "#fb923c",
    },
    SYN_SENT: {
      bg: "rgba(168, 85, 247, 0.08)",
      text: "#a855f7",
      dot: "#a855f7",
    },
    SYN_RECV: {
      bg: "rgba(168, 85, 247, 0.08)",
      text: "#a855f7",
      dot: "#a855f7",
    },
    UNKNOWN: {
      bg: "rgba(110, 110, 115, 0.08)",
      text: "#6e6e73",
      dot: "#6e6e73",
    },
  };

function getStateColor(state: string) {
  return STATE_COLORS[state] || STATE_COLORS.UNKNOWN;
}

/** Deduplicate entries that share the same pid+port+protocol (e.g. IPv4 + IPv6 listeners) */
function deduplicatePorts(arr: PortInfo[]): PortInfo[] {
  const seen = new Set<string>();
  return arr.filter((p) => {
    const key = `${p.pid}-${p.port}-${p.protocol}-${normalizeState(p.state)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortPorts(arr: PortInfo[]): PortInfo[] {
  return [...arr].sort((a, b) => {
    const stateOrder = (s: string) => {
      const n = normalizeState(s);
      if (n === "LISTEN") return 0;
      if (n === "ESTABLISHED") return 1;
      return 2;
    };
    const diff = stateOrder(a.state) - stateOrder(b.state);
    return diff !== 0 ? diff : a.port - b.port;
  });
}

function filterPorts(ports: PortInfo[], query: string): PortInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return ports;

  const isNumeric = /^\d+$/.test(q);
  return ports.filter((p) => {
    if (isNumeric) {
      return p.port.toString().startsWith(q) || p.pid.toString() === q;
    }
    return (
      p.name.toLowerCase().includes(q) ||
      p.protocol.toLowerCase().includes(q) ||
      normalizeState(p.state).toLowerCase().includes(q)
    );
  });
}

/* ── Icons ── */

function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function KillIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function PortViewerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7" cy="7" r="5" />
      <path d="M11 11L14 14" />
    </svg>
  );
}

/* ── State Badge ── */

function StateBadge({ state }: { state: string }) {
  const normalized = normalizeState(state);
  const color = getStateColor(normalized);
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

/* ── Action Button ── */

function ActionButton({
  onClick,
  tooltip,
  variant = "default",
  children,
}: {
  onClick: () => void;
  tooltip: string;
  variant?: "default" | "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`flex items-center justify-center size-6 rounded-md transition-all duration-150 ${
        variant === "danger"
          ? "text-text-faint hover:text-danger hover:bg-[rgba(248,81,73,0.08)]"
          : "text-text-faint hover:text-text-secondary hover:bg-bg-hover"
      }`}
    >
      {children}
    </button>
  );
}

/* ── Port Card ── */

function PortCard({
  entry,
  onKill,
  onRefresh,
}: {
  entry: PortInfo;
  onKill: (pid: number) => Promise<void>;
  onRefresh: () => void;
}) {
  const [killing, setKilling] = useState(false);
  const [confirmKill, setConfirmKill] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const confirmTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKill = async () => {
    if (!confirmKill) {
      setConfirmKill(true);
      confirmTimeout.current = setTimeout(() => setConfirmKill(false), 3000);
      return;
    }
    if (confirmTimeout.current) clearTimeout(confirmTimeout.current);
    setKilling(true);
    try {
      await onKill(entry.pid);
      setTimeout(onRefresh, 500);
    } catch {
      setKilling(false);
      setConfirmKill(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const displayName = entry.name || "Unknown";
  const shortCommand = entry.command
    ? entry.command.length > 80
      ? entry.command.slice(0, 80) + "..."
      : entry.command
    : "\u2014";

  return (
    <div className="group rounded-xl border border-border-subtle/60 bg-bg-secondary/30 hover:bg-bg-secondary/60 transition-colors duration-150 overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[18px] font-mono font-bold text-accent tabular-nums shrink-0">
            :{entry.port}
          </span>
          <span className="text-[12.5px] font-medium text-text truncate">
            {displayName}
          </span>
          <StateBadge state={entry.state} />
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <ActionButton tooltip="Copy PID" onClick={() => copyToClipboard(String(entry.pid), "PID")}>
            {copied === "PID" ? <CheckIcon /> : <CopyIcon />}
          </ActionButton>
          <ActionButton tooltip="Copy command" onClick={() => copyToClipboard(entry.command || displayName, "cmd")}>
            {copied === "cmd" ? (
              <CheckIcon />
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" />
              </svg>
            )}
          </ActionButton>
          <ActionButton tooltip={confirmKill ? "Click again to confirm" : "Kill process"} variant="danger" onClick={handleKill}>
            {killing ? (
              <span className="size-3 border-2 border-danger/40 border-t-danger rounded-full animate-spin" />
            ) : confirmKill ? (
              <span className="text-[9px] font-bold text-danger">Kill?</span>
            ) : (
              <KillIcon />
            )}
          </ActionButton>
        </div>
      </div>
      <div className="px-3.5 pb-2.5 flex flex-wrap gap-x-5 gap-y-1">
        <Detail label="PID" value={String(entry.pid)} />
        <Detail label="Protocol" value={entry.protocol} />
        <Detail label="Address" value={entry.local_address} />
        {entry.remote_address &&
          entry.remote_address !== "*:*" &&
          entry.remote_address !== "0.0.0.0:*" && (
            <Detail label="Remote" value={entry.remote_address} />
          )}
        <Detail label="Memory" value={formatMemory(entry.memory_bytes)} />
      </div>
      {entry.command && (
        <div className="px-3.5 pb-2.5">
          <p className="text-[10px] text-text-faint/60 font-mono leading-relaxed truncate" title={entry.command}>
            {shortCommand}
          </p>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9.5px] uppercase tracking-wider text-text-faint/50 font-medium">
        {label}
      </span>
      <span className="text-[11px] text-text-secondary font-mono">{value}</span>
    </div>
  );
}


/* ── Loading / Error States ── */

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 select-none">
      <div className="size-8 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
      <p className="text-[12px] text-text-faint/60">Scanning ports...</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 select-none">
      <div className="flex items-center justify-center size-10 rounded-xl bg-[rgba(248,81,73,0.06)] border border-[rgba(248,81,73,0.12)]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cl-danger)" strokeWidth="2" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-[12px] text-danger/80">{message}</p>
        <button onClick={onRetry} className="mt-2 text-[11px] text-accent hover:underline">
          Try again
        </button>
      </div>
    </div>
  );
}

/* ── Main Viewer (self-contained cards view) ── */

function PortViewer() {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const fetchPorts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<PortInfo[]>("scan_ports");
      setPorts(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPorts();
  }, [fetchPorts]);

  const handleKill = useCallback(async (pid: number) => {
    await invoke("kill_process", { pid });
  }, []);

  const filtered = sortPorts(deduplicatePorts(filterPorts(ports, query)));
  const listening = filtered.filter((p) => normalizeState(p.state) === "LISTEN").length;
  const established = filtered.filter((p) => normalizeState(p.state) === "ESTABLISHED").length;

  if (loading && ports.length === 0) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchPorts} />;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle/50 bg-bg-secondary/20 shrink-0">
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

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] text-text-secondary">
            <strong className="text-text font-semibold">{filtered.length}</strong>{" "}
            port{filtered.length !== 1 ? "s" : ""}
          </span>
          {listening > 0 && (
            <span className="text-[10.5px] text-[#34d058]/80">{listening} listening</span>
          )}
          {established > 0 && (
            <span className="text-[10.5px] text-[#4d9fff]/80">{established} established</span>
          )}
        </div>

        <button onClick={fetchPorts} disabled={loading} title="Refresh"
          className="flex items-center justify-center size-[26px] rounded-md text-text-faint hover:text-text hover:bg-bg-hover transition-colors disabled:opacity-40 shrink-0">
          <span className={loading ? "animate-spin" : ""}><RefreshIcon /></span>
        </button>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 select-none">
          <p className="text-[12px] text-text-faint/60">No matches found</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto p-3 space-y-2">
          {filtered.map((entry, idx) => (
            <PortCard
              key={idx}
              entry={entry}
              onKill={handleKill}
              onRefresh={fetchPorts}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Register ── */

registerOutputView({
  id: "port-viewer",
  name: "Port Viewer",
  icon: PortViewerIcon,
  parse: (output: string) => output,
  component: PortViewer,
});
