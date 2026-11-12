import type { HierarchyNode } from "./hierarchy";

/** A block of rows inside a card. Every section in a card has the same number of columns. */
export interface BoardSection {
  /** Sub-group shown as the section title, or null for the card's direct leaves. */
  heading: HierarchyNode | null;
  columns: HierarchyNode[][];
}
export interface BoardCard {
  id: string;
  kind: "overview" | "header" | "card";
  entry: HierarchyNode | null;
  /** Direct leaves first, then one section per sub-group. */
  sections: BoardSection[];
  position: { x: number; y: number };
  width: number;
  height: number;
}
export interface BoardMetrics {
  /** Height of the overview and single-root header cards. */
  nodeHeight: number;
  /** Height of a group card's title area. */
  headerHeight: number;
  rowHeight: number;
}
export const BOARD_CARD_WIDTH = 244;
export const BOARD_ROW_INDENT = 14;
export const BOARD_CARD_PADDING = 6;
/** Vertical space between sections inside a card. */
export const BOARD_SECTION_GAP = 6;
const ROW_COLUMN_WIDTH = BOARD_CARD_WIDTH - BOARD_CARD_PADDING * 2;
const ROW_COLUMN_GAP = 10;
const ROWS_PER_COLUMN = 16;
const CARD_GAP = 24;
const BOARD_MARGIN = 32;
const SECTION_GAP = 44;
const MAX_BOARD_COLUMNS = 24;

function shortestColumn(heights: number[]): number {
  return heights.indexOf(Math.min(...heights));
}

/** Splits branches into columns in reading order, never breaking a branch apart. */
function splitBranches(branches: HierarchyNode[][], columnCount: number): HierarchyNode[][] {
  const target = Math.ceil(branches.reduce((total, branch) => total + branch.length, 0) / columnCount);
  const columns: HierarchyNode[][] = [[]];
  for (const branch of branches) {
    const current = columns[columns.length - 1];
    if (current.length && current.length + branch.length > target && columns.length < columnCount) columns.push([...branch]);
    else current.push(...branch);
  }
  while (columns.length < columnCount) columns.push([]);
  return columns;
}

/** Groups a subtree's descendants by the subtree root's direct children. */
function branchesOf(root: HierarchyNode, descendants: HierarchyNode[]): HierarchyNode[][] {
  const branches: HierarchyNode[][] = [];
  for (const entry of descendants) {
    if (entry.parentId === root.id || !branches.length) branches.push([]);
    branches[branches.length - 1].push(entry);
  }
  return branches;
}

export function boardSectionsHeight(sections: BoardSection[], rowHeight: number) {
  if (!sections.length) return 0;
  const rows = sections.reduce((total, section) => total + (section.heading ? 1 : 0) + Math.max(0, ...section.columns.map((column) => column.length)), 0);
  return rows * rowHeight + (sections.length - 1) * BOARD_SECTION_GAP + BOARD_CARD_PADDING * 2;
}

function planCard(entries: HierarchyNode[], metrics: BoardMetrics): BoardCard {
  const root = entries[0];
  const leaves: HierarchyNode[][] = [];
  const groups: { heading: HierarchyNode; descendants: HierarchyNode[] }[] = [];
  for (const entry of entries.slice(1)) {
    if (entry.parentId === root.id) {
      if (entry.children.length) groups.push({ heading: entry, descendants: [] });
      else leaves.push([entry]);
    } else if (groups.length) groups[groups.length - 1].descendants.push(entry);
    else leaves.push([entry]);
  }
  const rowCount = entries.length - 1;
  const columnCount = Math.max(1, Math.ceil(Math.sqrt(rowCount / ROWS_PER_COLUMN)));
  const sections: BoardSection[] = [
    ...(leaves.length ? [{ heading: null, columns: splitBranches(leaves, columnCount) }] : []),
    ...groups.map(({ heading, descendants }) => ({ heading, columns: splitBranches(branchesOf(heading, descendants), columnCount) })),
  ];
  const deepest = Math.max(0, ...groups.flatMap(({ heading, descendants }) => descendants.map((entry) => entry.depth - heading.depth - 1)));
  const columnWidth = ROW_COLUMN_WIDTH + deepest * BOARD_ROW_INDENT;
  return {
    id: root.id,
    kind: "card",
    entry: root,
    sections,
    position: { x: 0, y: 0 },
    width: Math.max(BOARD_CARD_WIDTH, BOARD_CARD_PADDING * 2 + columnCount * columnWidth + (columnCount - 1) * ROW_COLUMN_GAP),
    height: metrics.headerHeight + boardSectionsHeight(sections, metrics.rowHeight),
  };
}

/** Group each top-level family into one card and pack the cards into a roughly square board. */
export function layoutBalancedHierarchy(entries: HierarchyNode[], rootIds: string[], overviewId: string, metrics: BoardMetrics) {
  const cards: BoardCard[] = [];
  if (!entries.length) return { cards, bounds: { x: 0, y: 0, width: 1, height: 1 } };
  const singleRoot = rootIds.length === 1 ? entries.find((entry) => entry.id === rootIds[0]) : undefined;
  const header = singleRoot && entries.some((entry) => entry.parentId === singleRoot.id) ? singleRoot : null;
  const groupRoots = entries.filter((entry) => (header ? entry.parentId === header.id : !entry.parentId));
  const plans = groupRoots.map((root) => {
    const start = entries.indexOf(root);
    let end = start + 1;
    while (end < entries.length && entries[end].depth > root.depth) end++;
    return planCard(entries.slice(start, end), metrics);
  });
  const columnWidth = Math.max(...plans.map((plan) => plan.width));
  const top = BOARD_MARGIN + metrics.nodeHeight + (header ? metrics.nodeHeight + SECTION_GAP : 0) + SECTION_GAP;
  const occupiedArea = plans.reduce((total, plan) => total + plan.width * plan.height, 0);
  let best: { score: number; width: number; height: number; placements: { column: number; y: number }[] } | null = null;
  for (let columns = 1; columns <= Math.min(plans.length, MAX_BOARD_COLUMNS); columns++) {
    const heights = Array(columns).fill(0) as number[];
    const placements = plans.map((plan) => {
      const column = shortestColumn(heights);
      const y = heights[column];
      heights[column] += plan.height + CARD_GAP;
      return { column, y };
    });
    const width = BOARD_MARGIN * 2 + columns * columnWidth + (columns - 1) * CARD_GAP;
    const height = top + Math.max(...heights) - CARD_GAP + BOARD_MARGIN;
    const emptyFraction = 1 - occupiedArea / (width * height);
    const score = Math.abs(Math.log(width / height)) + emptyFraction * 0.12;
    if (!best || score < best.score) best = { score, width, height, placements };
  }
  const board = best!;
  const centered = (width: number) => (board.width - width) / 2;
  cards.push({
    id: overviewId,
    kind: "overview",
    entry: null,
    sections: [],
    position: { x: centered(BOARD_CARD_WIDTH), y: BOARD_MARGIN },
    width: BOARD_CARD_WIDTH,
    height: metrics.nodeHeight,
  });
  if (header) {
    cards.push({
      id: header.id,
      kind: "header",
      entry: header,
      sections: [],
      position: { x: centered(BOARD_CARD_WIDTH), y: BOARD_MARGIN + metrics.nodeHeight + SECTION_GAP },
      width: BOARD_CARD_WIDTH,
      height: metrics.nodeHeight,
    });
  }
  plans.forEach((plan, index) => {
    const placement = board.placements[index];
    const x = BOARD_MARGIN + placement.column * (columnWidth + CARD_GAP);
    cards.push({ ...plan, position: { x, y: top + placement.y } });
  });
  return { cards, bounds: { x: 0, y: 0, width: board.width, height: board.height } };
}
