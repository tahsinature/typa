import type { HierarchyNode } from "./hierarchy";

type Side = "top" | "bottom" | "left";
export interface BalancedNode {
  id: string;
  entry: HierarchyNode | null;
  position: { x: number; y: number };
  sourceSide: Side;
  targetSide: Side;
}
export interface BalancedGroup {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface BalancedConnection {
  id: string;
  source: string;
  target: string;
  route: { kind: "header" | "overview" | "group" | "outline"; railX?: number };
}
const CARD_WIDTH = 244;
const PADDING = 24;
const INDENT = 22;
const ROW_GAP = 18;
const GROUP_GAP = 72;
const MAX_BOARD_COLUMNS = 24;

interface GroupPlan {
  root: HierarchyNode;
  nodes: BalancedNode[];
  width: number;
  height: number;
}
function shortestColumn(heights: number[]): number {
  return heights.indexOf(Math.min(...heights));
}

function planGroup(entries: HierarchyNode[], nodeHeight: number): GroupPlan {
  const root = entries[0];
  const branches: HierarchyNode[][] = [];
  for (const entry of entries.slice(1)) {
    if (entry.parentId === root.id) branches.push([]);
    branches[branches.length - 1].push(entry);
  }
  const columns = Math.max(1, Math.ceil(Math.sqrt(branches.length / 4)));
  const deepestBranch = Math.max(0, ...entries.slice(1).map((entry) => entry.depth - root.depth - 1));
  const columnWidth = CARD_WIDTH + deepestBranch * INDENT;
  const width = PADDING * 2 + columns * columnWidth + (columns - 1) * 40;
  const nodes: BalancedNode[] = [
    {
      id: root.id,
      entry: root,
      position: { x: (width - CARD_WIDTH) / 2, y: PADDING },
      sourceSide: "bottom",
      targetSide: "top",
    },
  ];
  const columnHeights = Array(columns).fill(0) as number[];
  for (const branch of branches) {
    const column = shortestColumn(columnHeights);
    branch.forEach((entry, index) =>
      nodes.push({
        id: entry.id,
        entry,
        position: {
          x: PADDING + column * (columnWidth + 40) + (entry.depth - root.depth - 1) * INDENT,
          y: PADDING + nodeHeight + 40 + columnHeights[column] + index * (nodeHeight + ROW_GAP),
        },
        sourceSide: "left",
        targetSide: "left",
      }),
    );
    columnHeights[column] += branch.length * (nodeHeight + ROW_GAP);
  }
  const height = branches.length ? PADDING * 2 + nodeHeight + 40 + Math.max(...columnHeights) - ROW_GAP : PADDING * 2 + nodeHeight;
  return { root, nodes, width, height };
}

/** Keep each family together and choose a column count that makes the board close to square. */
export function layoutBalancedHierarchy(entries: HierarchyNode[], rootIds: string[], overviewId: string, nodeHeight = 88) {
  const nodes: BalancedNode[] = [];
  const groups: BalancedGroup[] = [];
  const edges: BalancedConnection[] = [];
  if (!entries.length) return { nodes, groups, edges, bounds: { x: 0, y: 0, width: 1, height: 1 } };
  const singleRoot = rootIds.length === 1 ? entries.find((entry) => entry.id === rootIds[0]) : undefined;
  const header = singleRoot && entries.some((entry) => entry.parentId === singleRoot.id) ? singleRoot : null;
  const groupRoots = entries.filter((entry) => (header ? entry.parentId === header.id : !entry.parentId));
  const plans = groupRoots.map((root) => {
    const start = entries.indexOf(root);
    let end = start + 1;
    while (end < entries.length && entries[end].depth > root.depth) end++;
    return planGroup(entries.slice(start, end), nodeHeight);
  });
  const columnWidth = Math.max(...plans.map((plan) => plan.width));
  const groupTop = 32 + nodeHeight + (header ? nodeHeight + 64 : 0) + 96;
  const occupiedArea = plans.reduce((total, plan) => total + plan.width * plan.height, 0);
  let best: { score: number; width: number; height: number; placements: { column: number; y: number }[] } | null = null;
  for (let columns = 1; columns <= Math.min(plans.length, MAX_BOARD_COLUMNS); columns++) {
    const heights = Array(columns).fill(0) as number[];
    const placements = plans.map((plan) => {
      const column = shortestColumn(heights);
      const y = heights[column];
      heights[column] += plan.height + GROUP_GAP;
      return { column, y };
    });
    const width = 128 + columns * columnWidth + (columns - 1) * GROUP_GAP;
    const height = groupTop + Math.max(...heights) - GROUP_GAP + 32;
    const emptyFraction = 1 - occupiedArea / (width * height);
    const score = Math.abs(Math.log(width / height)) + emptyFraction * 0.12;
    if (!best || score < best.score) best = { score, width, height, placements };
  }
  const packed = best!;
  nodes.push({ id: overviewId, entry: null, position: { x: (packed.width - CARD_WIDTH) / 2, y: 32 }, sourceSide: "bottom", targetSide: "top" });
  if (header) {
    nodes.push({ id: header.id, entry: header, position: { x: (packed.width - CARD_WIDTH) / 2, y: 32 + nodeHeight + 64 }, sourceSide: "bottom", targetSide: "top" });
    edges.push({ id: `branch-${header.id}`, source: overviewId, target: header.id, route: { kind: "header" } });
  }
  for (const [index, plan] of plans.entries()) {
    const placement = packed.placements[index];
    const columnX = 64 + placement.column * (columnWidth + GROUP_GAP);
    const x = columnX + (columnWidth - plan.width) / 2;
    const y = groupTop + placement.y;
    groups.push({ id: plan.root.id, x, y, width: plan.width, height: plan.height });
    const positioned = plan.nodes.map((node) => ({ ...node, position: { x: node.position.x + x, y: node.position.y + y } }));
    nodes.push(...positioned);
    const localById = new Map(positioned.map((node) => [node.id, node]));
    for (const node of positioned) {
      const entry = node.entry!;
      const root = entry.id === plan.root.id;
      const directChild = entry.parentId === plan.root.id;
      edges.push({
        id: `branch-${entry.id}`,
        source: entry.parentId ?? overviewId,
        target: entry.id,
        route: root
          ? { kind: "overview", railX: columnX - 24 }
          : directChild
            ? { kind: "group", railX: node.position.x - 14 }
            : { kind: "outline", railX: localById.get(entry.parentId!)!.position.x - 14 },
      });
    }
  }
  return { nodes, groups, edges, bounds: { x: 0, y: 0, width: packed.width, height: packed.height } };
}
