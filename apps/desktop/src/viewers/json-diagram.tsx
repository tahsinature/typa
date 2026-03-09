import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { registerViewer } from "./registry";

/* ── Sizing ── */

const CHAR_W = 7;
const ROW_H = 24;
const HEADER_H = 28;
const PAD_X = 20;
const MIN_W = 100;
const MAX_W = 320;

function textW(s: string): number {
  return Math.min(MAX_W, Math.max(MIN_W, s.length * CHAR_W + PAD_X));
}

/* ── Types ── */

interface RowData {
  key: string | null;
  val: string;
  type: string;
}

interface NodePayload {
  [key: string]: unknown;
  label: string;
  rows: RowData[];
  childKeys: string[];
  w: number;
  h: number;
  highlight: "none" | "match" | "active";
}

/* ── Parse JSON → nodes + edges ── */

function parseJsonToGraph(data: unknown): { nodes: Node<NodePayload>[]; edges: Edge[] } {
  const nodes: Node<NodePayload>[] = [];
  const edges: Edge[] = [];
  let nid = 0;

  function traverse(value: unknown, label: string, parentId?: string, edgeLabel?: string) {
    const id = `n${nid++}`;

    if (parentId !== undefined) {
      edges.push({
        id: `e${parentId}-${id}`,
        source: parentId,
        sourceHandle: `src-${edgeLabel}`,
        target: id,
        targetHandle: "target",
        type: "smoothstep",
      });
    }

    // Primitive
    if (value === null || typeof value !== "object") {
      const val = value === null ? "null" : String(value);
      const rows: RowData[] = [{ key: null, val, type: value === null ? "null" : typeof value }];
      const w = textW(val);
      const h = HEADER_H + ROW_H;
      nodes.push({ id, type: "jsonNode", position: { x: 0, y: 0 }, data: { label, rows, childKeys: [], w, h, highlight: "none" } });
      return;
    }

    const isArr = Array.isArray(value);
    const entries = isArr
      ? value.map((v, i) => [String(i), v] as const)
      : Object.entries(value as Record<string, unknown>);

    const rows: RowData[] = [];
    const children: { key: string; value: unknown }[] = [];
    const childKeys: string[] = [];

    for (const [k, v] of entries) {
      if (v !== null && typeof v === "object") {
        const isChildArr = Array.isArray(v);
        rows.push({ key: k, val: isChildArr ? `[${v.length}]` : `{${Object.keys(v).length}}`, type: isChildArr ? "array" : "object" });
        children.push({ key: k, value: v });
        childKeys.push(k);
      } else {
        rows.push({ key: k, val: v === null ? "null" : String(v), type: v === null ? "null" : typeof v });
      }
    }

    if (rows.length === 0) {
      rows.push({ key: null, val: isArr ? "[]" : "{}", type: "empty" });
    }

    let maxLen = label.length;
    for (const r of rows) {
      const text = r.key ? `${r.key}: ${r.val}` : r.val;
      maxLen = Math.max(maxLen, text.length);
    }

    const w = textW("x".repeat(maxLen));
    const h = HEADER_H + rows.length * ROW_H;
    const nodeLabel = isArr ? `${label} [${(value as unknown[]).length}]` : label;

    nodes.push({ id, type: "jsonNode", position: { x: 0, y: 0 }, data: { label: nodeLabel, rows, childKeys, w, h, highlight: "none" } });

    for (const child of children) {
      traverse(child.value, child.key, id, child.key);
    }
  }

  traverse(data, "root");

  // Layout with dagre
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 30, ranksep: 80 });

  for (const node of nodes) {
    g.setNode(node.id, { width: node.data.w, height: node.data.h });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  for (const node of nodes) {
    const pos = g.node(node.id);
    node.position = { x: pos.x - node.data.w / 2, y: pos.y - node.data.h / 2 };
  }

  return { nodes, edges };
}

/* ── Colors ── */

function valColor(type: string, val: string, isDark: boolean): string {
  if (type === "null" || val === "null") return isDark ? "#939598" : "#afafaf";
  if (type === "number") return isDark ? "#e8c479" : "#FD0079";
  if (type === "boolean") return val === "true" ? (isDark ? "#00DC7D" : "#748700") : (isDark ? "#F85C50" : "#FF0000");
  if (type === "object" || type === "array") return isDark ? "#7a7a80" : "#999";
  return isDark ? "#DCE5E7" : "#535353";
}

function keyColorVal(isDark: boolean): string {
  return isDark ? "#59b8ff" : "#761CEA";
}

/* ── Custom Node ── */

function JsonNode({ data }: { data: NodePayload }) {
  const { label, rows, childKeys, w, h, highlight } = data;
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";

  const borderColor =
    highlight === "active" ? "#f59e0b"
    : highlight === "match" ? "#3B82F6"
    : isDark ? "#424242" : "#BCBEC0";

  const boxShadow =
    highlight === "active" ? "0 0 0 2px rgba(245, 158, 11, 0.4)"
    : highlight === "match" ? "0 0 0 2px rgba(59, 130, 246, 0.3)"
    : "none";

  return (
    <div
      style={{
        width: w,
        height: h,
        background: isDark ? "#292929" : "#ffffff",
        border: `2px solid ${borderColor}`,
        borderRadius: 6,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11,
        overflow: "hidden",
        boxShadow,
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
    >
      <Handle type="target" position={Position.Left} id="target" style={{ width: 8, height: 8, background: isDark ? "#666" : "#999" }} />

      {/* Header */}
      <div
        style={{
          height: HEADER_H,
          padding: "0 10px",
          display: "flex",
          alignItems: "center",
          background: isDark ? "#323232" : "#f0f0f2",
          borderBottom: `1px solid ${isDark ? "#3a3a3a" : "#e0e0e0"}`,
          color: isDark ? "#a0a0a5" : "#666",
          fontWeight: 600,
          borderRadius: "6px 6px 0 0",
        }}
      >
        {label}
      </div>

      {/* Rows */}
      {rows.map((row, i) => (
        <div
          key={i}
          style={{
            height: ROW_H,
            padding: "0 10px",
            display: "flex",
            alignItems: "center",
            justifyContent: row.key !== null ? "space-between" : "center",
            borderBottom: i < rows.length - 1 ? `1px solid ${isDark ? "#333" : "#eee"}` : "none",
            position: "relative",
          }}
        >
          {row.key !== null ? (
            <>
              <span style={{ color: keyColorVal(isDark), flexShrink: 0, maxWidth: "40%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.key}</span>
              <span style={{ color: valColor(row.type, row.val, isDark), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginLeft: 8, textAlign: "right" }}>{row.val}</span>
            </>
          ) : (
            <span style={{ color: valColor(row.type, row.val, isDark), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>{row.val}</span>
          )}

          {childKeys.includes(row.key ?? "") && (
            <Handle
              type="source"
              position={Position.Right}
              id={`src-${row.key}`}
              style={{ width: 8, height: 8, background: isDark ? "#59b8ff" : "#761CEA" }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

const nodeTypes = { jsonNode: JsonNode };

/* ── Viewer ── */

function JsonDiagramViewer({ data, theme }: { data: unknown; theme: "dark" | "light" }) {
  const isDark = theme === "dark";

  const { initialNodes, initialEdges } = useMemo(() => {
    const { nodes, edges } = parseJsonToGraph(data);
    return { initialNodes: nodes, initialEdges: edges };
  }, [data]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const [rfInstance, setRfInstance] = useState<any>(null);

  // Search
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const prevQueryRef = useRef("");

  const matches = useMemo(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    const results: string[] = [];
    for (const n of initialNodes) {
      if (n.data.label.toLowerCase().includes(q)) { results.push(n.id); continue; }
      for (const r of n.data.rows) {
        const text = r.key ? `${r.key}: ${r.val}` : r.val;
        if (text.toLowerCase().includes(q)) { results.push(n.id); break; }
      }
    }
    return results;
  }, [query, initialNodes]);

  // Update node highlights when search changes
  useEffect(() => {
    const matchSet = new Set(matches);
    const activeNodeId = matches[activeIdx] ?? null;
    setNodes((nds) =>
      nds.map((n) => {
        const highlight: NodePayload["highlight"] =
          n.id === activeNodeId ? "active"
          : matchSet.has(n.id) ? "match"
          : "none";
        if ((n.data as NodePayload).highlight === highlight) return n;
        return { ...n, data: { ...n.data, highlight } };
      })
    );
  }, [matches, activeIdx, setNodes]);

  useEffect(() => {
    if (query !== prevQueryRef.current) {
      prevQueryRef.current = query;
      setActiveIdx(0);
    }
  }, [query]);

  const focusNode = useCallback((nodeId: string) => {
    if (!rfInstance) return;
    const node = initialNodes.find((n) => n.id === nodeId);
    if (!node) return;
    rfInstance.setCenter(node.position.x + node.data.w / 2, node.position.y + node.data.h / 2, { zoom: 1.2, duration: 400 });
  }, [rfInstance, initialNodes]);

  useEffect(() => {
    if (matches.length > 0 && matches[activeIdx]) {
      focusNode(matches[activeIdx]);
    }
  }, [activeIdx, matches, focusNode]);

  const skip = useCallback(() => {
    if (matches.length > 0) setActiveIdx((i) => (i + 1) % matches.length);
  }, [matches.length]);

  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="json-diagram h-full w-full relative" style={{ backgroundColor: isDark ? "#141414" : "#f7f7f7" }}>
      {/* Search */}
      <div className="absolute top-2 left-2 z-[10] flex items-center gap-1.5" style={{ cursor: "default" }}>
        <div className="relative flex items-center">
          <svg className="absolute left-2 text-text-faint pointer-events-none" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="7" cy="7" r="5" /><path d="M11 11L14 14" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") skip(); }}
            placeholder="Search nodes..."
            className="h-[30px] w-[200px] rounded-md pl-7 pr-2 text-[12px] bg-bg-elevated text-text border border-border-subtle outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/40 placeholder:text-text-faint shadow-md"
          />
        </div>
        {query && (
          <span className="text-[11px] text-text-muted bg-bg-elevated px-2 py-1 rounded-md border border-border-subtle shadow-sm">
            {matches.length > 0 ? `${activeIdx + 1}/${matches.length}` : "0 results"}
          </span>
        )}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onInit={setRfInstance}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.05}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: "smoothstep", style: { stroke: isDark ? "#444" : "#BCBEC0", strokeWidth: 1.5 } }}
      >
        <Background color={isDark ? "#2a2a30" : "#e5e5ea"} gap={20} size={1} />
        <Controls
          position="bottom-right"
          showInteractive={false}
          style={{
            borderRadius: 8,
            border: `1px solid ${isDark ? "#3a3a40" : "#d2d2d7"}`,
            backgroundColor: isDark ? "#2c2d33" : "#ffffff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
        />
        <MiniMap
          position="bottom-left"
          nodeColor={isDark ? "#4d9fff" : "#0071e3"}
          maskColor={isDark ? "rgba(30,31,35,0.85)" : "rgba(250,250,250,0.85)"}
          style={{
            borderRadius: 8,
            border: `1px solid ${isDark ? "#3a3a40" : "#d2d2d7"}`,
            backgroundColor: isDark ? "#252529" : "#f2f2f4",
          }}
        />
      </ReactFlow>
    </div>
  );
}

/* ── Icon ── */

function DiagramIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <rect x="1" y="1" width="5" height="4" rx="1" />
      <rect x="10" y="1" width="5" height="4" rx="1" />
      <rect x="10" y="11" width="5" height="4" rx="1" />
      <path d="M6 3H10M10 13H8V3" />
    </svg>
  );
}

registerViewer({
  parse: (output) => JSON.parse(output),
  id: "json-diagram",
  name: "Diagram",
  icon: DiagramIcon,
  component: JsonDiagramViewer,
});
