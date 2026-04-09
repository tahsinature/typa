import { useState } from "react";
import { JsonViewer } from "@textea/json-viewer";
import { registerOutputView } from "./registry";

/* -- Types -- */

interface JsonNode {
  index: number;
  type: string;
  value: unknown;
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

function NodeCard({ node, theme }: { node: JsonNode; theme: "dark" | "light" }) {
  const [collapsed, setCollapsed] = useState(false);
  const isExpandable = node.type === "object" || node.type === "array";

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: "var(--bg-secondary)",
        border: node.type === "error"
          ? "1px solid rgba(248, 81, 73, 0.2)"
          : "1px solid var(--cl-border-subtle)",
      }}
    >
      {/* Header */}
      <div
        className="w-full px-3 py-2 flex items-center gap-2"
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
        <span className="text-[11px] text-text-faint font-mono">#{node.index}</span>
        <TypeBadge type={node.type} />
        <SizeLabel node={node} />
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="px-3 py-2">
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

function SummaryBar({ nodes }: { nodes: JsonNode[] }) {
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
      className="rounded-lg px-3 py-2 flex items-center gap-2 text-[12px] text-text-secondary"
      style={{ background: "var(--bg-secondary)", border: "1px solid var(--cl-border-subtle)" }}
    >
      <span className="font-medium text-text">{nodes.length} node{nodes.length !== 1 ? "s" : ""}</span>
      <span className="text-text-faint">&mdash;</span>
      <span>{parts.join(", ")}</span>
    </div>
  );
}

/* -- Main Component -- */

function MultiJsonViewer({ data, theme }: { data: MultiJsonData; theme: "dark" | "light" }) {
  if (!data?.nodes?.length) {
    return (
      <div className="h-full flex items-center justify-center text-text-faint text-[13px]">
        Paste NDJSON (one JSON value per line)
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 flex flex-col gap-3" style={{ backgroundColor: "var(--bg)" }}>
      <SummaryBar nodes={data.nodes} />
      {data.nodes.map((node) => (
        <NodeCard key={node.index} node={node} theme={theme} />
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
