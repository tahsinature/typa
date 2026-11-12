import dagre from "dagre";
import { Position, type Edge, type Node } from "@xyflow/react";
import { layoutBalancedHierarchy, type BalancedGroup, type Hierarchy, type HierarchyNode } from "@typa/engine";

export type CountMode = "leaves" | "nodes" | "quantity";
export type Direction = "LR" | "TB" | "BALANCED";
export const OVERVIEW_ID = "hierarchy-overview";
export const VISIBLE_LIMIT = 600;
export const branchColors = ["#62b5a5", "#88a9ea", "#d9aa65", "#ba9bdb", "#d58fa3", "#7eb6ce", "#a9b979", "#ce9e7e"];
export const countLabels: Record<CountMode, string> = { leaves: "Leaves", nodes: "All entries", quantity: "Quantity" };
export const formatCount = (value: number) => value.toLocaleString(undefined, Number.isInteger(value) ? {} : { maximumSignificantDigits: 12 });
export function countNode(node: HierarchyNode, mode: CountMode) {
  return mode === "leaves" ? node.leafCount : mode === "nodes" ? node.nodeCount : node.quantityTotal;
}
export function totalCount(tree: Hierarchy, mode: CountMode) {
  return mode === "leaves" ? tree.leaves : mode === "nodes" ? tree.nodes.length : tree.quantity;
}

export function initialCollapsed(tree: Hierarchy): Set<string> {
  if (tree.nodes.length <= 80) return new Set();
  const overviewDepth = tree.roots.length === 1 ? 1 : 0;
  return new Set(tree.nodes.filter((node) => node.depth >= overviewDepth && node.children.length).map((node) => node.id));
}

function branchIndexes(tree: Hierarchy) {
  const indexes = new Map<string, number>();
  let nextBranch = 0;
  for (const node of tree.nodes) {
    const index = tree.roots.length !== 1 ? node.branch : node.depth === 1 ? nextBranch++ : node.parentId ? (indexes.get(node.parentId) ?? 0) : 0;
    indexes.set(node.id, index);
  }
  return indexes;
}

export function hierarchyColors(tree: Hierarchy) {
  return new Map([...branchIndexes(tree)].map(([id, index]) => [id, branchColors[index % branchColors.length]]));
}
export interface TreeNodeData extends Record<string, unknown> {
  entry: HierarchyNode | null;
  name: string;
  color: string;
  direction: Direction;
  sourcePosition: Position;
  targetPosition: Position;
  collapsed: boolean;
  match: boolean;
  count: number;
  mode: CountMode;
  onToggle: (id: string) => void;
}
export type DiagramNode = Node<TreeNodeData, "hierarchy">;

export function getAncestors(id: string, byId: Map<string, HierarchyNode>): HierarchyNode[] {
  const path: HierarchyNode[] = [];
  let entry = byId.get(id);
  while (entry) {
    path.push(entry);
    entry = entry.parentId ? byId.get(entry.parentId) : undefined;
  }
  return path.reverse();
}

export function layoutHierarchy(tree: Hierarchy, collapsed: Set<string>, query: string, direction: Direction, compact: boolean) {
  const byId = new Map(tree.nodes.map((node) => [node.id, node]));
  const colors = hierarchyColors(tree);
  const matches = new Set<string>();
  const included = new Set<string>();
  const search = query.trim().toLocaleLowerCase();
  if (search) {
    for (const entry of tree.nodes) {
      if (!entry.name.toLocaleLowerCase().includes(search)) continue;
      matches.add(entry.id);
      for (const ancestor of getAncestors(entry.id, byId)) included.add(ancestor.id);
    }
  }
  const visible = new Set<string>();
  const entries: HierarchyNode[] = [];
  let eligibleCount = 0;
  for (const entry of tree.nodes) {
    const allowed = search ? included.has(entry.id) : !entry.parentId || (visible.has(entry.parentId) && !collapsed.has(entry.parentId));
    if (!allowed) continue;
    visible.add(entry.id);
    eligibleCount++;
    if (entries.length < VISIBLE_LIMIT) entries.push(entry);
  }
  const candidates: { id: string; entry: HierarchyNode | null }[] = entries.length ? [{ id: OVERVIEW_ID, entry: null }, ...entries.map((entry) => ({ id: entry.id, entry }))] : [];
  if (direction === "BALANCED") {
    const balanced = layoutBalancedHierarchy(entries, tree.roots, OVERVIEW_ID, compact ? 72 : 88);
    const positions = { top: Position.Top, bottom: Position.Bottom, left: Position.Left };
    return {
      nodes: balanced.nodes.map(({ sourceSide, targetSide, ...node }) => ({ ...node, sourcePosition: positions[sourceSide], targetPosition: positions[targetSide] })),
      edges: balanced.edges.map(
        (edge): Edge => ({
          ...edge,
          type: "balanced",
          data: edge.route,
          selectable: false,
          style: { stroke: colors.get(edge.target), strokeWidth: 1.5, opacity: edge.route.kind === "overview" ? 0.35 : 0.65 },
        }),
      ),
      groups: balanced.groups,
      colors,
      bounds: balanced.bounds,
      matches,
      eligibleCount,
      truncated: eligibleCount > VISIBLE_LIMIT,
    };
  }
  const drawn = new Set(candidates.map((node) => node.id));
  const edges: Edge[] = entries
    .map((entry) => ({
      id: `branch-${entry.id}`,
      source: entry.parentId ?? OVERVIEW_ID,
      target: entry.id,
      type: "smoothstep",
      selectable: false,
      style: { stroke: colors.get(entry.id), strokeWidth: 1.5, opacity: 0.6 },
    }))
    .filter((edge) => drawn.has(edge.source));
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: direction, nodesep: compact ? 18 : 34, ranksep: compact ? 60 : 96, marginx: 30, marginy: 30 });
  for (const node of candidates) graph.setNode(node.id, { width: 244, height: compact ? 72 : 88 });
  for (const edge of edges) graph.setEdge(edge.source, edge.target);
  if (candidates.length) dagre.layout(graph);
  return {
    nodes: candidates.map((node) => {
      const position = graph.node(node.id);
      return {
        ...node,
        position: { x: position.x - 122, y: position.y - (compact ? 36 : 44) },
        sourcePosition: direction === "LR" ? Position.Right : Position.Bottom,
        targetPosition: direction === "LR" ? Position.Left : Position.Top,
      };
    }),
    edges,
    groups: [] as BalancedGroup[],
    colors,
    bounds: { x: 0, y: 0, width: graph.graph().width || 1, height: graph.graph().height || 1 },
    matches,
    eligibleCount,
    truncated: eligibleCount > VISIBLE_LIMIT,
  };
}
