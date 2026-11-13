import { DIAGRAM_FONT, DIAGRAM_EDGE_TYPE, diagramEdgeStyle } from "@/components/diagram/diagram-style";
import dagre from "dagre";
import { Position, type Edge } from "@xyflow/react";
import type { HierarchyNode } from "@typa/engine";

const BUNDLE_ROWS_PER_COLUMN = 8;
const BUNDLE_PADDING = 6;

export interface TreeLayoutMetrics {
  nodeHeight: number;
  rowHeight: number;
}
export interface TreeLayoutItem {
  id: string;
  kind: "overview" | "node" | "leaves";
  entry: HierarchyNode | null;
  columns: HierarchyNode[][];
  position: { x: number; y: number };
  width: number;
  height: number;
}

export const leavesId = (parentId: string) => `leaves:${parentId}`;
export const isLeavesId = (id: string) => id.startsWith("leaves:");

let measureContext: CanvasRenderingContext2D | null | undefined;
function textWidth(text: string, font: string) {
  if (measureContext === undefined) measureContext = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  if (!measureContext) return text.length * 7;
  measureContext.font = `${font} ${DIAGRAM_FONT}`;
  return measureContext.measureText(text).width;
}
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
// Icon, gaps, padding and the count pill around the name.
const nodeWidth = (name: string) => clamp(Math.ceil(textWidth(name, "600 12px")) + 92, 120, 260);
// Leaf icon, gap, padding and the count around each row name.
const columnWidth = (leaves: HierarchyNode[]) => clamp(Math.max(...leaves.map((entry) => textWidth(entry.name, "11.5px"))) + 64, 110, 220);
const COLUMN_GAP = 10;

function splitColumns(leaves: HierarchyNode[]) {
  const columnCount = Math.ceil(leaves.length / BUNDLE_ROWS_PER_COLUMN);
  const rows = Math.ceil(leaves.length / columnCount);
  return Array.from({ length: columnCount }, (_, index) => leaves.slice(index * rows, (index + 1) * rows));
}

/** Lays out a top-down or left-right tree with rounded right-angle connectors. Each family's leaves are drawn together in one list box. */
export function layoutTree(entries: HierarchyNode[], overviewId: string, direction: "LR" | "TB", metrics: TreeLayoutMetrics) {
  const leavesByParent = new Map<string, HierarchyNode[]>();
  for (const entry of entries) {
    if (entry.children.length) continue;
    const parentId = entry.parentId ?? overviewId;
    leavesByParent.set(parentId, [...(leavesByParent.get(parentId) ?? []), entry]);
  }
  const bundled = new Set<string>();
  const items: Omit<TreeLayoutItem, "position">[] = entries.length
    ? [{ id: overviewId, kind: "overview", entry: null, columns: [], width: nodeWidth("All entries"), height: metrics.nodeHeight }]
    : [];
  for (const [parentId, leaves] of leavesByParent) {
    leaves.forEach((leaf) => bundled.add(leaf.id));
    const columns = splitColumns(leaves);
    const width = columnWidth(leaves) * columns.length + (columns.length - 1) * COLUMN_GAP + BUNDLE_PADDING * 2;
    items.push({ id: leavesId(parentId), kind: "leaves", entry: null, columns, width, height: columns[0].length * metrics.rowHeight + BUNDLE_PADDING * 2 });
  }
  for (const entry of entries) {
    if (!bundled.has(entry.id)) items.push({ id: entry.id, kind: "node", entry, columns: [], width: nodeWidth(entry.name), height: metrics.nodeHeight });
  }

  const edge = (source: string, target: string): Edge => ({
    id: `branch-${target}`,
    source,
    target,
    type: DIAGRAM_EDGE_TYPE,
    selectable: false,
    style: diagramEdgeStyle(),
  });
  const ids = new Set(items.map((item) => item.id));
  const edges = items
    .filter((item) => item.kind !== "overview")
    .map((item) => {
      if (item.kind === "leaves") return edge(item.id.slice("leaves:".length), item.id);
      return edge(item.entry!.parentId ?? overviewId, item.id);
    })
    .filter((link) => ids.has(link.source));

  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  const compact = metrics.nodeHeight < 40;
  graph.setGraph({ rankdir: direction, nodesep: compact ? 14 : 22, ranksep: direction === "LR" ? (compact ? 50 : 70) : compact ? 36 : 52, marginx: 24, marginy: 24 });
  for (const item of items) graph.setNode(item.id, { width: item.width, height: item.height });
  for (const { source, target } of edges) graph.setEdge(source, target);
  if (items.length) dagre.layout(graph);

  // Dagre centers each level, so boxes of different sizes would start at different offsets. Align each level to its leading edge instead.
  const vertical = direction === "TB";
  const levelStart = new Map<number, number>();
  for (const item of items) {
    const center = graph.node(item.id);
    const level = Math.round(vertical ? center.y : center.x);
    const start = level - (vertical ? item.height : item.width) / 2;
    levelStart.set(level, Math.min(levelStart.get(level) ?? start, start));
  }
  const anchors = new Map<string, { x: number; y: number }>();
  const nodes: TreeLayoutItem[] = items.map((item) => {
    const center = graph.node(item.id);
    const start = levelStart.get(Math.round(vertical ? center.y : center.x))!;
    const position = vertical ? { x: center.x - item.width / 2, y: start } : { x: start, y: center.y - item.height / 2 };
    anchors.set(item.id, { x: position.x + item.width / 2, y: position.y + item.height / 2 });
    const columnStep = (item.width - BUNDLE_PADDING * 2 + COLUMN_GAP) / Math.max(1, item.columns.length);
    item.columns.forEach((column, index) =>
      column.forEach((entry, row) =>
        anchors.set(entry.id, { x: position.x + BUNDLE_PADDING + columnStep * (index + 0.5), y: position.y + BUNDLE_PADDING + (row + 0.5) * metrics.rowHeight }),
      ),
    );
    return { ...item, position };
  });
  const sourcePosition = direction === "LR" ? Position.Right : Position.Bottom;
  const targetPosition = direction === "LR" ? Position.Left : Position.Top;
  return { nodes, edges, anchors, sourcePosition, targetPosition, bounds: { x: 0, y: 0, width: graph.graph().width || 1, height: graph.graph().height || 1 } };
}
