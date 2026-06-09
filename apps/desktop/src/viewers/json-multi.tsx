import { useMemo, useRef, useState, type ReactNode } from "react";
import { JsonViewer } from "@textea/json-viewer";
import { setNodeField, type NodeStatusOption, type Transform } from "@typa/engine";
import { registerOutputView } from "./registry";
import { StatusPicker, StatusSummary, statusOption, STATUS_FILTER_UNMARKED } from "./json-multi-status";

/* -- Types -- */

interface JsonNode {
  index: number;
  type: string;
  value: unknown;
  name?: string;
  status?: string;
  keys?: number;
  items?: number;
  raw: string;
  error?: string;
}

interface MultiJsonData {
  nodes: JsonNode[];
}

/* -- Type Badge -- */

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    object: { bg: "rgba(77, 159, 255, 0.1)", text: "var(--cl-accent)" },
    array: { bg: "rgba(168, 85, 247, 0.1)", text: "#a855f7" },
    string: { bg: "rgba(52, 208, 88, 0.1)", text: "var(--cl-result)" },
    number: { bg: "rgba(251, 191, 36, 0.1)", text: "#fbbf24" },
    boolean: { bg: "rgba(244, 114, 182, 0.1)", text: "#f472b6" },
    null: { bg: "rgba(168, 168, 168, 0.1)", text: "var(--text-muted)" },
    error: { bg: "rgba(248, 81, 73, 0.1)", text: "var(--cl-danger)" },
  };
  const c = colors[type] ?? { bg: "rgba(168, 168, 168, 0.1)", text: "var(--text-muted)" };

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium"
      style={{ background: c.bg, color: c.text }}
    >
      {type}
    </span>
  );
}

/* -- Size Label -- */

function SizeLabel({ node }: { node: JsonNode }) {
  if (node.type === "object" && node.keys != null) {
    return <span className="text-[11px] text-text-muted font-mono">{node.keys} key{node.keys !== 1 ? "s" : ""}</span>;
  }
  if (node.type === "array" && node.items != null) {
    return <span className="text-[11px] text-text-muted font-mono">{node.items} item{node.items !== 1 ? "s" : ""}</span>;
  }
  return null;
}

/* -- Node Card -- */

function NodeCard({
  node,
  theme,
  options,
  onSetStatus,
  cardRef,
}: {
  node: JsonNode;
  theme: "dark" | "light";
  options?: NodeStatusOption[];
  onSetStatus?: (index: number, value: string | null) => void;
  cardRef?: (el: HTMLDivElement | null) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const isExpandable = node.type === "object" || node.type === "array";
  const statusColor = statusOption(options ?? [], node.status)?.color;

  return (
    <div
      ref={cardRef}
      className="rounded-lg overflow-hidden shrink-0"
      style={{
        background: "var(--bg-secondary)",
        border: node.type === "error"
          ? "1px solid rgba(248, 81, 73, 0.2)"
          : "1px solid var(--cl-border-subtle)",
        borderLeft: statusColor ? `3px solid ${statusColor}` : undefined,
      }}
    >
      {/* Header */}
      <div
        className="w-full px-3 py-2 flex items-center gap-2 min-w-0"
        style={{
          cursor: isExpandable ? "pointer" : "default",
          borderBottom: collapsed ? "none" : "1px solid var(--cl-border-subtle)",
        }}
        onClick={() => isExpandable && setCollapsed(!collapsed)}
      >
        {isExpandable && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="currentColor"
            className="text-text-muted shrink-0 transition-transform"
            style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
          >
            <path d="M2 3l3 3.5L8 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <span className="text-[11px] text-text-faint font-mono shrink-0">#{node.index}</span>
        {node.name && (
          <span className="text-[13px] font-medium text-text truncate min-w-0" title={node.name}>
            {node.name}
          </span>
        )}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <TypeBadge type={node.type} />
          <SizeLabel node={node} />
          {options && onSetStatus && node.type === "object" && (
            <StatusPicker
              status={node.status}
              options={options}
              onSelect={(value) => onSetStatus(node.index, value)}
            />
          )}
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="px-3 py-2" style={{ opacity: node.status ? 0.55 : undefined }}>
          {node.type === "error" ? (
            <div className="flex flex-col gap-1">
              <code className="text-[12px] font-mono text-text-secondary break-all">{node.raw}</code>
              <span className="text-[11px] font-mono" style={{ color: "var(--cl-danger)" }}>
                {node.error}
              </span>
            </div>
          ) : isExpandable ? (
            <JsonViewer
              value={node.value}
              theme={theme === "dark" ? "dark" : "light"}
              rootName={false}
              defaultInspectDepth={2}
              enableClipboard
              displayDataTypes={false}
              style={{
                backgroundColor: "transparent",
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                fontSize: 13,
              }}
            />
          ) : (
            <code className="text-[13px] font-mono text-text">{JSON.stringify(node.value)}</code>
          )}
        </div>
      )}
    </div>
  );
}

/* -- Summary Bar -- */

function SummaryBar({ nodes, extra }: { nodes: JsonNode[]; extra?: ReactNode }) {
  const counts: Record<string, number> = {};
  for (const n of nodes) {
    counts[n.type] = (counts[n.type] || 0) + 1;
  }

  const parts: string[] = [];
  if (counts.object) parts.push(`${counts.object} object${counts.object > 1 ? "s" : ""}`);
  if (counts.array) parts.push(`${counts.array} array${counts.array > 1 ? "s" : ""}`);
  const primitiveCount = (counts.string || 0) + (counts.number || 0) + (counts.boolean || 0) + (counts.null || 0);
  if (primitiveCount) parts.push(`${primitiveCount} primitive${primitiveCount > 1 ? "s" : ""}`);
  if (counts.error) parts.push(`${counts.error} error${counts.error > 1 ? "s" : ""}`);

  return (
    <div
      className="rounded-lg px-3 py-2 flex items-center gap-2 text-[12px] text-text-secondary shrink-0"
      style={{ background: "var(--bg-secondary)", border: "1px solid var(--cl-border-subtle)" }}
    >
      <span className="font-medium text-text">{nodes.length} node{nodes.length !== 1 ? "s" : ""}</span>
      <span className="text-text-faint">&mdash;</span>
      <span>{parts.join(", ")}</span>
      {extra && <div className="ml-auto">{extra}</div>}
    </div>
  );
}

/* -- Main Component -- */

function MultiJsonViewer({
  data,
  theme,
  input,
  onInputChange,
  transform,
}: {
  data: MultiJsonData;
  theme: "dark" | "light";
  input?: string;
  onInputChange?: (value: string) => void;
  transform?: Transform;
}) {
  const statusConfig = transform?.nodeStatus;
  const options = statusConfig?.options ?? [];
  const field = statusConfig?.field ?? "_status";
  // Marking writes back into the input, so it needs both the input and a setter.
  const canMark = !!(statusConfig && options.length > 0 && typeof input === "string" && onInputChange);

  const [filter, setFilter] = useState<string | null>(null);
  const [jumpCursor, setJumpCursor] = useState(0);
  const cardRefs = useRef(new Map<number, HTMLDivElement>());

  const nodes = data?.nodes ?? [];

  const { counts, left } = useMemo(() => {
    const counts: Record<string, number> = {};
    let markable = 0;
    let marked = 0;
    for (const n of nodes) {
      if (n.type === "object") markable++;
      if (n.status) {
        counts[n.status] = (counts[n.status] ?? 0) + 1;
        marked++;
      }
    }
    return { counts, left: Math.max(0, markable - marked) };
  }, [nodes]);

  const displayedNodes = useMemo(() => {
    if (!canMark || filter === null) return nodes;
    if (filter === STATUS_FILTER_UNMARKED) return nodes.filter((n) => !n.status);
    return nodes.filter((n) => n.status === filter);
  }, [nodes, canMark, filter]);

  if (!nodes.length) {
    return (
      <div className="h-full flex items-center justify-center text-text-faint text-[13px]">
        Paste NDJSON (one JSON value per line)
      </div>
    );
  }

  const setStatus = (index: number, value: string | null) => {
    if (typeof input !== "string" || !onInputChange) return;
    onInputChange(setNodeField(input, index, field, value ?? undefined));
  };

  const unmarked = displayedNodes.filter((n) => n.type === "object" && !n.status);
  const jumpNext = () => {
    if (!unmarked.length) return;
    const next = unmarked.find((n) => n.index > jumpCursor) ?? unmarked[0];
    setJumpCursor(next.index);
    cardRefs.current.get(next.index)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  return (
    <div className="h-full overflow-auto p-4 flex flex-col gap-3" style={{ backgroundColor: "var(--bg)" }}>
      <SummaryBar
        nodes={nodes}
        extra={
          canMark ? (
            <StatusSummary
              counts={counts}
              left={left}
              options={options}
              filter={filter}
              onFilter={setFilter}
              onJumpNext={jumpNext}
              jumpDisabled={unmarked.length === 0}
            />
          ) : undefined
        }
      />
      {displayedNodes.map((node) => (
        <NodeCard
          key={node.index}
          node={node}
          theme={theme}
          options={canMark ? options : undefined}
          onSetStatus={canMark ? setStatus : undefined}
          cardRef={(el) => {
            if (el) cardRefs.current.set(node.index, el);
            else cardRefs.current.delete(node.index);
          }}
        />
      ))}
    </div>
  );
}

/* -- Icon -- */

function MultiJsonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

registerOutputView({
  id: "json-multi",
  name: "Multi View",
  parse: (output): MultiJsonData => JSON.parse(output),
  icon: MultiJsonIcon,
  component: MultiJsonViewer,
});
