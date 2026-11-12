import { Position, type Edge, type Node } from "@xyflow/react";
import { layoutTree } from "./tree-layout";
import {
  BOARD_CARD_PADDING,
  BOARD_SECTION_GAP,
  layoutBalancedHierarchy,
  type BoardCard,
  type BoardMetrics,
  type BoardSection,
  type Hierarchy,
  type HierarchyNode,
} from "@typa/engine";

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
  sourcePosition: Position;
  targetPosition: Position;
  collapsed: boolean;
  match: boolean;
  count: number;
  mode: CountMode;
  onToggle: (id: string) => void;
}
export interface CardRow {
  entry: HierarchyNode;
  indent: number;
  collapsed: boolean;
  match: boolean;
  count: number;
}
export interface GroupCardData extends Record<string, unknown> {
  /** Header entry. Leaf list boxes have no header. */
  entry: HierarchyNode | null;
  color: string;
  collapsed: boolean;
  match: boolean;
  count: number;
  sections: { heading: CardRow | null; columns: CardRow[][] }[];
  /** Edge handle side for leaf list boxes in the tree layouts. */
  targetPosition: Position | null;
  /** Selected row inside this card, if any. */
  selectedRowId: string | null;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}
export type DiagramNode = Node<TreeNodeData, "hierarchy"> | Node<GroupCardData, "groupCard">;
export interface LayoutNode {
  id: string;
  kind: BoardCard["kind"] | "node" | "leaves";
  entry: HierarchyNode | null;
  sections: BoardSection[];
  position: { x: number; y: number };
  width: number;
  height: number;
  sourcePosition: Position;
  targetPosition: Position;
}
export function boardMetrics(compact: boolean): BoardMetrics {
  return compact ? { nodeHeight: 34, headerHeight: 38, rowHeight: 22 } : { nodeHeight: 40, headerHeight: 44, rowHeight: 26 };
}

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
  const shared = { colors, matches, eligibleCount, truncated: eligibleCount > VISIBLE_LIMIT };
  if (direction === "BALANCED") {
    const metrics = boardMetrics(compact);
    const board = layoutBalancedHierarchy(entries, tree.roots, OVERVIEW_ID, metrics);
    const anchors = new Map<string, { x: number; y: number }>();
    const nodes = board.cards.map((card): LayoutNode => {
      const { x, y } = card.position;
      anchors.set(card.id, { x: x + card.width / 2, y: y + Math.min(card.height, metrics.headerHeight) / 2 });
      let top = y + metrics.headerHeight + BOARD_CARD_PADDING;
      for (const { heading, columns } of card.sections) {
        if (heading) {
          anchors.set(heading.id, { x: x + card.width / 2, y: top + metrics.rowHeight / 2 });
          top += metrics.rowHeight;
        }
        columns.forEach((column, columnIndex) =>
          column.forEach((entry, row) => anchors.set(entry.id, { x: x + (card.width / columns.length) * (columnIndex + 0.5), y: top + (row + 0.5) * metrics.rowHeight })),
        );
        top += Math.max(0, ...columns.map((column) => column.length)) * metrics.rowHeight + BOARD_SECTION_GAP;
      }
      return { ...card, sourcePosition: Position.Bottom, targetPosition: Position.Top };
    });
    const header = board.cards.find((card) => card.kind === "header");
    const edges: Edge[] = header
      ? [{ id: `branch-${header.id}`, source: OVERVIEW_ID, target: header.id, type: "default", selectable: false, style: { stroke: "var(--cl-border)", strokeWidth: 1.6 } }]
      : [];
    return { ...shared, nodes, edges, anchors, bounds: board.bounds };
  }
  const layout = layoutTree(entries, OVERVIEW_ID, direction, compact ? { nodeHeight: 34, rowHeight: 22 } : { nodeHeight: 40, rowHeight: 26 }, colors);
  const nodes = layout.nodes.map(
    ({ columns, ...item }): LayoutNode => ({
      ...item,
      sections: columns.length ? [{ heading: null, columns }] : [],
      sourcePosition: layout.sourcePosition,
      targetPosition: layout.targetPosition,
    }),
  );
  return { ...shared, nodes, edges: layout.edges, anchors: layout.anchors, bounds: layout.bounds };
}
