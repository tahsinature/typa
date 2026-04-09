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

const CHAR_W = 7.2;
const ROW_H = 28;
const HEADER_H = 32;
const PAD_X = 48;
const MIN_W = 130;
const MAX_W = 420;

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
  highlight: "none" | "match" | "active" | "focus" | "selected";
  originalValue: unknown;
  onRowClick?: (childKey: string) => void;
  onHeaderClick?: () => void;
  onParentClick?: () => void;
  hasParent?: boolean;
}

/* ── Parse JSON → nodes + edges ── */

/* ── Detect multi-json wrapper from json-multi-view transform ── */

interface MultiJsonNode {
  index: number;
  type: string;
  value: unknown;
}

function isMultiJsonData(data: unknown): data is { nodes: MultiJsonNode[] } {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return false;
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.nodes)) return false;
  const nodes = obj.nodes as unknown[];
  return nodes.length > 0 && nodes.every(
    (n) => n !== null && typeof n === "object" && "index" in n && "type" in n && "value" in n
  );
}

function parseJsonToGraph(data: unknown): { nodes: Node<NodePayload>[]; edges: Edge[] } {
  // Multi-json: render each node's value as a separate root
  if (isMultiJsonData(data)) {
    return parseMultiRootGraph(data.nodes);
  }
  return parseSingleRootGraph(data, "root");
}

function parseSingleRootGraph(data: unknown, rootLabel: string): { nodes: Node<NodePayload>[]; edges: Edge[]; nid: number } {
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
      nodes.push({ id, type: "jsonNode", position: { x: 0, y: 0 }, data: { label, rows, childKeys: [], w, h, highlight: "none", originalValue: value } });
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

    nodes.push({ id, type: "jsonNode", position: { x: 0, y: 0 }, data: { label: nodeLabel, rows, childKeys, w, h, highlight: "none", originalValue: value } });

    for (const child of children) {
      traverse(child.value, child.key, id, child.key);
    }
  }

  traverse(data, rootLabel);

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

  return { nodes, edges, nid };
}

function parseMultiRootGraph(multiNodes: MultiJsonNode[]): { nodes: Node<NodePayload>[]; edges: Edge[] } {
  const allNodes: Node<NodePayload>[] = [];
  const allEdges: Edge[] = [];
  let yOffset = 0;
  let globalNid = 0;

  for (const mn of multiNodes) {
    if (mn.type === "error") continue;

    const label = `#${mn.index}`;
    const { nodes, edges, nid } = parseSingleRootGraph(mn.value, label);

    // Offset node IDs to avoid collisions across subgraphs
    const idPrefix = `g${mn.index}_`;
    const idMap = new Map<string, string>();
    for (const node of nodes) {
      const newId = `${idPrefix}${node.id}`;
      idMap.set(node.id, newId);
      node.id = newId;
      node.position.y += yOffset;
      allNodes.push(node);
    }
    for (const edge of edges) {
      edge.id = `${idPrefix}${edge.id}`;
      edge.source = idMap.get(edge.source) ?? edge.source;
      edge.target = idMap.get(edge.target) ?? edge.target;
      allEdges.push(edge);
    }

    // Calculate the bounding box height of this subgraph for vertical stacking
    let maxY = 0;
    for (const node of nodes) {
      const bottom = node.position.y + node.data.h;
      if (bottom > maxY) maxY = bottom;
    }
    yOffset = maxY + 60; // gap between subgraphs
    globalNid += nid;
  }

  return { nodes: allNodes, edges: allEdges };
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

/* ── Copy helpers ── */

function useCopyFeedback() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text);
    if (timeout.current) clearTimeout(timeout.current);
    setCopiedKey(key);
    timeout.current = setTimeout(() => setCopiedKey(null), 1200);
  }, []);

  return { copiedKey, copy };
}

function CopyCheck({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#34d058" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CopyIcon({ size = 11, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

/* ── Custom Node ── */

function TypeBadge({ isArray, isDark }: { isArray: boolean; isDark: boolean }) {
  const text = isArray ? "[]" : "{}";
  const color = isArray ? (isDark ? "#e8c479" : "#d97706") : (isDark ? "#a78bfa" : "#7c3aed");
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        color,
        background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
        padding: "1px 4px",
        borderRadius: 4,
        marginRight: 6,
        whiteSpace: "nowrap",
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {text}
    </span>
  );
}

function PathBreadcrumb({ path, isDark, onSegmentClick }: { path: string; isDark: boolean; onSegmentClick?: (segmentPath: string) => void }) {
  const [copied, setCopied] = useState(false);
  const dotPath = path;

  const handleCopy = () => {
    navigator.clipboard.writeText(dotPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const segments = path.split(".");

  return (
    <div className="absolute top-2 right-2 z-[10] flex items-center gap-2 rounded-lg border shadow-md px-1 py-1"
      style={{
        background: isDark ? "rgba(30,30,34,0.95)" : "rgba(255,255,255,0.97)",
        borderColor: isDark ? "rgba(167,139,250,0.2)" : "rgba(167,139,250,0.25)",
      }}
    >
      <div className="flex items-center gap-0.5 pl-2">
        {segments.map((segment, i) => {
          const segmentPath = segments.slice(0, i + 1).join(".");
          const isLast = i === segments.length - 1;
          return (
            <span key={i} className="flex items-center gap-0.5">
              <span
                className="text-[11px] font-mono"
                onClick={!isLast && onSegmentClick ? () => onSegmentClick(segmentPath) : undefined}
                style={{
                  color: isLast ? "#a78bfa" : (isDark ? "#888" : "#777"),
                  fontWeight: isLast ? 600 : 400,
                  cursor: isLast ? "default" : "pointer",
                  borderRadius: 3,
                  padding: "1px 3px",
                  transition: "background 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => { if (!isLast) { e.currentTarget.style.background = isDark ? "rgba(167,139,250,0.12)" : "rgba(167,139,250,0.08)"; e.currentTarget.style.color = "#a78bfa"; } }}
                onMouseLeave={(e) => { if (!isLast) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = isDark ? "#888" : "#777"; } }}
              >
                {segment}
              </span>
              {!isLast && (
                <span className="text-[10px] font-mono" style={{ color: isDark ? "#444" : "#ccc" }}>.</span>
              )}
            </span>
          );
        })}
      </div>
      <button
        onClick={handleCopy}
        className="flex items-center justify-center h-6 px-2 rounded-md text-[10px] font-medium transition-all duration-150 cursor-pointer"
        style={{
          background: copied
            ? (isDark ? "rgba(52,208,88,0.1)" : "rgba(52,208,88,0.08)")
            : (isDark ? "rgba(167,139,250,0.1)" : "rgba(167,139,250,0.08)"),
          color: copied ? "#34d058" : "#a78bfa",
        }}
      >
        {copied ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
    </div>
  );
}

function ChevronRight({ color }: { color: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginLeft: 4 }}>
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

function JsonNode({ data }: { data: NodePayload }) {
  const { label, rows, childKeys, w, h, highlight, originalValue, onRowClick, onHeaderClick, onParentClick, hasParent } = data;
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const { copiedKey, copy } = useCopyFeedback();

  const isArray = label.includes("[");

  const borderColor =
    highlight === "active" ? "#f59e0b"
    : highlight === "selected" ? "#a78bfa"
    : highlight === "focus" ? "#59b8ff"
    : highlight === "match" ? "#34d058"
    : isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";

  const boxShadow =
    highlight === "active"
      ? "0 0 0 2px rgba(245, 158, 11, 0.4), 0 4px 12px rgba(0,0,0,0.15)"
    : highlight === "selected"
      ? "0 0 0 2px rgba(167, 139, 250, 0.4), 0 0 16px rgba(167, 139, 250, 0.1)"
    : highlight === "focus"
      ? "0 0 0 3px rgba(89, 184, 255, 0.4), 0 0 20px rgba(89, 184, 255, 0.12)"
    : highlight === "match"
      ? "0 0 0 2px rgba(52, 208, 88, 0.4), 0 0 16px rgba(52, 208, 88, 0.1)"
    : isDark
      ? "0 2px 8px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)"
      : "0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)";

  const bgColor =
    highlight === "active" ? (isDark ? "#2e2a1e" : "#fffbeb")
    : highlight === "selected" ? (isDark ? "#252030" : "#f5f3ff")
    : highlight === "match" ? (isDark ? "#1a2e1e" : "#f0fdf4")
    : isDark ? "#26262a" : "#ffffff";

  return (
    <div
      style={{
        width: w,
        height: h,
        background: bgColor,
        border: `${highlight === "match" || highlight === "active" ? "2px" : "1px"} solid ${borderColor}`,
        borderRadius: 10,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11.5,
        overflow: "hidden",
        boxShadow,
        transition: "border-color 0.25s, box-shadow 0.25s",
      }}
    >
      <Handle type="target" position={Position.Left} id="target" style={{
        width: 10, height: 10,
        background: isDark ? "#26262a" : "#fff",
        border: `2px solid ${isDark ? "#555" : "#bbb"}`,
        borderRadius: "50%",
      }} />

      {/* Header */}
      <div
        onClick={onHeaderClick}
        style={{
          height: HEADER_H,
          padding: "0 12px",
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          background: isDark
            ? "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)"
            : "linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.04) 100%)",
          borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
          color: isDark ? "#b0b0b8" : "#555",
          fontWeight: 600,
          fontSize: 11,
          letterSpacing: 0.3,
          borderRadius: "10px 10px 0 0",
        }}
      >
        {hasParent && (
          <span
            onClick={(e) => { e.stopPropagation(); onParentClick?.(); }}
            onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? "rgba(167,139,250,0.15)" : "rgba(167,139,250,0.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"; }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 18,
              height: 18,
              borderRadius: 4,
              marginRight: 5,
              cursor: "pointer",
              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
              transition: "background 0.15s",
              flexShrink: 0,
            }}
            title="Go to parent"
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke={isDark ? "#a78bfa" : "#7c3aed"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 4L6 8L10 12" />
            </svg>
          </span>
        )}
        <TypeBadge isArray={isArray} isDark={isDark} />
        <span style={{ opacity: 0.9, flex: 1 }}>{label.replace(/\s*\[\d+\]/, "")}</span>
        <span
          onClick={(e) => {
            e.stopPropagation();
            copy(JSON.stringify(originalValue, null, 2), "__json__");
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? "rgba(167,139,250,0.15)" : "rgba(167,139,250,0.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"; }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 18,
            height: 18,
            borderRadius: 4,
            marginLeft: 4,
            cursor: "pointer",
            background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
            transition: "background 0.15s",
            flexShrink: 0,
          }}
          title="Copy as JSON"
        >
          {copiedKey === "__json__" ? (
            <CopyCheck size={10} />
          ) : (
            <CopyIcon size={10} color={isDark ? "#a78bfa" : "#7c3aed"} />
          )}
        </span>
      </div>

      {/* Rows */}
      {rows.map((row, i) => {
        const isChild = childKeys.includes(row.key ?? "");
        return (
          <div
            key={i}
            onClick={isChild && onRowClick ? () => onRowClick(row.key!) : undefined}
            style={{
              height: ROW_H,
              padding: "0 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: row.key !== null ? "space-between" : "center",
              borderBottom: i < rows.length - 1 ? `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}` : "none",
              position: "relative",
              cursor: isChild ? "pointer" : "default",
              background: "transparent",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => { if (isChild) e.currentTarget.style.background = isDark ? "rgba(89,184,255,0.06)" : "rgba(118,28,234,0.04)"; }}
            onMouseLeave={(e) => { if (isChild) e.currentTarget.style.background = "transparent"; }}
          >
            {row.key !== null ? (
              <>
                <span className="group/key" style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0, whiteSpace: "nowrap" }}>
                  <span style={{ color: keyColorVal(isDark), fontSize: 11 }}>{row.key}</span>
                  <span
                    className="invisible group-hover/key:visible cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      copy(row.key!, row.key!);
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      ...(copiedKey === row.key ? { visibility: "visible" as const } : {}),
                    }}
                    title="Copy key"
                  >
                    {copiedKey === row.key ? <CopyCheck size={9} /> : <CopyIcon size={9} color={isDark ? "#666" : "#aaa"} />}
                  </span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0, whiteSpace: "nowrap", marginLeft: 12, color: valColor(row.type, row.val, isDark), fontSize: 11 }}>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      copy(String(row.val), `__val__${row.key}`);
                    }}
                    style={{ cursor: "pointer" }}
                    title="Click to copy"
                  >
                    {copiedKey === `__val__${row.key}` ? <CopyCheck size={9} /> : row.val}
                  </span>
                  {isChild && <ChevronRight color={isDark ? "rgba(89,184,255,0.5)" : "rgba(118,28,234,0.4)"} />}
                </span>
              </>
            ) : (
              <span style={{ color: valColor(row.type, row.val, isDark), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", fontSize: 11 }}>{row.val}</span>
            )}

            {isChild && (
              <Handle
                type="source"
                position={Position.Right}
                id={`src-${row.key}`}
                style={{
                  width: 10, height: 10,
                  background: isDark ? "#26262a" : "#fff",
                  border: `2px solid ${isDark ? "#59b8ff" : "#761CEA"}`,
                  borderRadius: "50%",
                }}
              />
            )}
          </div>
        );
      })}
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
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [rfInstance, setRfInstance] = useState<any>(null);

  // Sync ReactFlow state when data changes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

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

  // Build edge lookup: "sourceId:childKey" → targetNodeId
  // Build parent map: targetNodeId → { parentId, key }
  const { edgeLookup, parentMap } = useMemo(() => {
    const lookup = new Map<string, string>();
    const parents = new Map<string, { parentId: string; key: string }>();
    for (const edge of initialEdges) {
      const key = edge.sourceHandle?.replace("src-", "");
      if (key) {
        lookup.set(`${edge.source}:${key}`, edge.target);
        parents.set(edge.target, { parentId: edge.source, key });
      }
    }
    return { edgeLookup: lookup, parentMap: parents };
  }, [initialEdges]);

  // Resolve full path for a node
  const getNodePath = useCallback((nodeId: string): string => {
    const parts: string[] = [];
    let current = nodeId;
    while (current) {
      const parent = parentMap.get(current);
      if (parent) {
        parts.unshift(parent.key);
        current = parent.parentId;
      } else {
        parts.unshift("root");
        break;
      }
    }
    return parts.join(".");
  }, [parentMap]);

  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  // Resolve a dot-path like "root.data.items" to a node ID
  const resolvePathToNodeId = useCallback((path: string): string | null => {
    const parts = path.split(".");
    // "root" is always the first node (n0)
    if (parts.length <= 1) return initialNodes[0]?.id ?? null;
    let currentId = initialNodes[0]?.id;
    if (!currentId) return null;
    for (let i = 1; i < parts.length; i++) {
      const nextId = edgeLookup.get(`${currentId}:${parts[i]}`);
      if (!nextId) return null;
      currentId = nextId;
    }
    return currentId;
  }, [initialNodes, edgeLookup]);

  // Blip: briefly highlight a node then fade
  const blipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blipNode = useCallback((nodeId: string) => {
    if (blipTimeout.current) clearTimeout(blipTimeout.current);
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, highlight: n.id === nodeId ? "focus" as const : (n.data as NodePayload).highlight === "focus" ? "none" as const : (n.data as NodePayload).highlight },
      })),
    );
    blipTimeout.current = setTimeout(() => {
      setNodes((nds) =>
        nds.map((n) =>
          (n.data as NodePayload).highlight === "focus"
            ? { ...n, data: { ...n.data, highlight: "none" } }
            : n,
        ),
      );
    }, 1000);
  }, [setNodes]);

  // Collect edge IDs on the path from root to a given node
  const getPathEdgeIds = useCallback((nodeId: string): Set<string> => {
    const ids = new Set<string>();
    let current = nodeId;
    while (current) {
      const parent = parentMap.get(current);
      if (parent) {
        ids.add(`e${parent.parentId}-${current}`);
        current = parent.parentId;
      } else {
        break;
      }
    }
    return ids;
  }, [parentMap]);

  const highlightPathEdges = useCallback((pathEdgeIds: Set<string>) => {
    setEdges((eds) =>
      eds.map((e) => {
        const onPath = pathEdgeIds.has(e.id);
        return {
          ...e,
          style: {
            ...e.style,
            stroke: onPath ? "#a78bfa" : undefined,
            strokeWidth: onPath ? 2.5 : undefined,
          },
          animated: onPath,
        };
      }),
    );
  }, [setEdges]);

  const clearPathEdges = useCallback(() => {
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        style: { ...e.style, stroke: undefined, strokeWidth: undefined },
        animated: false,
      })),
    );
  }, [setEdges]);

  // Node selection on header click
  const selectNode = useCallback((nodeId: string) => {
    setSelectedPath(getNodePath(nodeId));
    setNodes((nds) =>
      nds.map((n) => {
        const d = n.data as NodePayload;
        if (n.id === nodeId && d.highlight !== "active") {
          return { ...n, data: { ...d, highlight: "selected" as const } };
        }
        if (n.id !== nodeId && d.highlight === "selected") {
          return { ...n, data: { ...d, highlight: "none" as const } };
        }
        return n;
      }),
    );
    highlightPathEdges(getPathEdgeIds(nodeId));
  }, [setNodes, getNodePath, highlightPathEdges, getPathEdgeIds]);

  // Navigate to a node: focus, blip, and select it
  const navigateToNode = useCallback((nodeId: string) => {
    focusNode(nodeId);
    blipNode(nodeId);
    selectNode(nodeId);
  }, [focusNode, blipNode, selectNode]);

  const handlePaneClick = useCallback(() => {
    setSelectedPath(null);
    setNodes((nds) =>
      nds.map((n) =>
        (n.data as NodePayload).highlight === "selected"
          ? { ...n, data: { ...n.data, highlight: "none" as const } }
          : n,
      ),
    );
    clearPathEdges();
  }, [setNodes, clearPathEdges]);

  // Inject onRowClick, onHeaderClick, and onParentClick into nodes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        const parent = parentMap.get(n.id);
        return {
          ...n,
          data: {
            ...n.data,
            hasParent: !!parent,
            onRowClick: (childKey: string) => {
              const targetId = edgeLookup.get(`${n.id}:${childKey}`);
              if (targetId) {
                focusNode(targetId);
                blipNode(targetId);
              }
            },
            onHeaderClick: () => selectNode(n.id),
            onParentClick: parent ? () => navigateToNode(parent.parentId) : undefined,
          },
        };
      }),
    );
  }, [edgeLookup, parentMap, focusNode, blipNode, selectNode, navigateToNode, setNodes]);

  useEffect(() => {
    if (matches.length > 0 && matches[activeIdx]) {
      focusNode(matches[activeIdx]);
    }
  }, [activeIdx, matches, focusNode]);

  const skipNext = useCallback(() => {
    if (matches.length > 0) setActiveIdx((i) => (i + 1) % matches.length);
  }, [matches.length]);

  const skipPrev = useCallback(() => {
    if (matches.length > 0) setActiveIdx((i) => (i - 1 + matches.length) % matches.length);
  }, [matches.length]);

  const searchRef = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery("");
    setActiveIdx(0);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => {
          searchRef.current?.focus();
          searchRef.current?.select();
        });
      }
      if (e.key === "Escape" && searchOpen) {
        e.preventDefault();
        closeSearch();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchOpen, closeSearch]);

  // Force WebKit to re-rasterize nodes when pointer re-enters the diagram
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleEnter = () => {
      const vp = el.querySelector<HTMLElement>(".react-flow__viewport");
      if (!vp) return;
      // Nudge transform to force re-rasterization, then restore
      const current = vp.style.transform;
      vp.style.transform = current + " translateZ(0)";
      requestAnimationFrame(() => { vp.style.transform = current; });
    };
    el.addEventListener("pointerenter", handleEnter);
    return () => el.removeEventListener("pointerenter", handleEnter);
  }, []);

  return (
    <div ref={containerRef} className="json-diagram h-full w-full relative" style={{ backgroundColor: isDark ? "#141414" : "#f7f7f7" }}>
      {/* Search */}
      {searchOpen && (
        <div className="absolute top-2 left-2 z-[10] flex items-center gap-1 rounded-lg border shadow-md px-1.5 py-1"
          style={{
            background: isDark ? "rgba(30,30,34,0.95)" : "rgba(255,255,255,0.97)",
            borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
          }}
        >
          <div className="relative flex items-center">
            <svg className="absolute left-2 pointer-events-none" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={isDark ? "#666" : "#999"} strokeWidth="1.5" strokeLinecap="round">
              <circle cx="7" cy="7" r="5" /><path d="M11 11L14 14" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.shiftKey) skipPrev();
                else if (e.key === "Enter") skipNext();
                else if (e.key === "Escape") closeSearch();
              }}
              placeholder="Search nodes..."
              className="h-[28px] w-[180px] rounded-md pl-7 pr-2 text-[12px] bg-transparent text-text outline-none placeholder:text-text-faint"
            />
          </div>
          {query && (
            <span className="text-[11px] px-1.5 tabular-nums" style={{ color: matches.length > 0 ? (isDark ? "#999" : "#666") : (isDark ? "#F85C50" : "#dc2626") }}>
              {matches.length > 0 ? `${activeIdx + 1}/${matches.length}` : "No results"}
            </span>
          )}
          <div className="flex items-center gap-0.5">
            <button
              onClick={skipPrev}
              disabled={matches.length === 0}
              className="flex items-center justify-center w-6 h-6 rounded-md cursor-pointer disabled:opacity-30 disabled:cursor-default"
              style={{ transition: "background 0.15s" }}
              onMouseEnter={(e) => { if (matches.length > 0) e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              title="Previous match (Shift+Enter)"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={isDark ? "#aaa" : "#555"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 10L8 6L4 10" />
              </svg>
            </button>
            <button
              onClick={skipNext}
              disabled={matches.length === 0}
              className="flex items-center justify-center w-6 h-6 rounded-md cursor-pointer disabled:opacity-30 disabled:cursor-default"
              style={{ transition: "background 0.15s" }}
              onMouseEnter={(e) => { if (matches.length > 0) e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              title="Next match (Enter)"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={isDark ? "#aaa" : "#555"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6L8 10L12 6" />
              </svg>
            </button>
            <div style={{ width: 1, height: 16, background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)", margin: "0 2px" }} />
            <button
              onClick={closeSearch}
              className="flex items-center justify-center w-6 h-6 rounded-md cursor-pointer"
              style={{ transition: "background 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              title="Close (Esc)"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={isDark ? "#aaa" : "#555"} strokeWidth="2" strokeLinecap="round">
                <path d="M4 4L12 12M12 4L4 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Node path breadcrumb */}
      {selectedPath && (
        <PathBreadcrumb
          path={selectedPath}
          isDark={isDark}
          onSegmentClick={(segmentPath) => {
            const nodeId = resolvePathToNodeId(segmentPath);
            if (nodeId) navigateToNode(nodeId);
          }}
        />
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onPaneClick={handlePaneClick}
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
