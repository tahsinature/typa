import { parseHierarchy } from "./hierarchy";

export interface OutlineEntry {
  id: string;
  name: string;
  quantity: number;
  depth: number;
}
export type DropPlacement = "before" | "inside" | "after";
let nextId = 0;
export function createOutlineEntry(depth = 0, name = "", quantity = 1): OutlineEntry {
  return { id: `outline-${++nextId}`, name, quantity, depth };
}
export function readOutlineEntries(source: string): OutlineEntry[] {
  return parseHierarchy(source).nodes.map((node) => createOutlineEntry(node.depth, node.name, node.quantity));
}
export function writeOutlineEntries(entries: OutlineEntry[]): string {
  interface JsonEntry {
    name: string;
    quantity?: number;
    children?: JsonEntry[];
  }
  const roots: JsonEntry[] = [];
  const parents: JsonEntry[] = [];
  for (const [index, entry] of entries.entries()) {
    if (!Number.isInteger(entry.depth) || entry.depth < 0 || entry.depth >= 64 || entry.depth > (entries[index - 1]?.depth ?? -1) + 1) {
      throw new Error("Nodes must stay within 64 nesting levels and directly below an existing parent.");
    }
    const node: JsonEntry = { name: entry.name.trim() || "Untitled" };
    if (entry.quantity !== 1) node.quantity = entry.quantity;
    parents.length = entry.depth;
    const parent = parents[entry.depth - 1];
    if (parent) (parent.children ??= []).push(node);
    else roots.push(node);
    parents.push(node);
  }
  return JSON.stringify(roots, null, 2);
}
export function outlineBranchEnd(entries: OutlineEntry[], index: number): number {
  let end = index + 1;
  while (end < entries.length && entries[end].depth > entries[index].depth) end++;
  return end;
}
export function outlineParent(entries: OutlineEntry[], index: number): number {
  if (!entries[index]?.depth) return -1;
  for (let i = index - 1; i >= 0; i--) if (entries[i].depth < entries[index].depth) return i;
  return -1;
}

/** Move an entire branch. Other nodes keep their parent and order. */
export function moveOutlineBranch(entries: OutlineEntry[], id: string, targetId: string, placement: DropPlacement): OutlineEntry[] | null {
  const start = entries.findIndex((entry) => entry.id === id);
  const target = entries.findIndex((entry) => entry.id === targetId);
  if (start < 0 || target < 0) return null;
  const end = outlineBranchEnd(entries, start);
  if (target >= start && target < end) return null;
  const depth = entries[target].depth + (placement === "inside" ? 1 : 0);
  const delta = depth - entries[start].depth;
  const branch = entries.slice(start, end).map((entry) => ({ ...entry, depth: entry.depth + delta }));
  if (branch.some((entry) => entry.depth >= 64)) return null;
  const remaining = [...entries.slice(0, start), ...entries.slice(end)];
  const targetIndex = remaining.findIndex((entry) => entry.id === targetId);
  const insert = placement === "before" ? targetIndex : outlineBranchEnd(remaining, targetIndex);
  const next = [...remaining.slice(0, insert), ...branch, ...remaining.slice(insert)];
  return next.every((entry, index) => entry.id === entries[index].id && entry.depth === entries[index].depth) ? null : next;
}

export function indentOutlineBranch(entries: OutlineEntry[], id: string): OutlineEntry[] | null {
  const index = entries.findIndex((entry) => entry.id === id);
  if (index <= 0) return null;
  let previous = index - 1;
  while (previous >= 0 && entries[previous].depth > entries[index].depth) previous--;
  if (previous < 0 || entries[previous].depth !== entries[index].depth) return null;
  return moveOutlineBranch(entries, id, entries[previous].id, "inside");
}
export function outdentOutlineBranch(entries: OutlineEntry[], id: string): OutlineEntry[] | null {
  const index = entries.findIndex((entry) => entry.id === id);
  const parent = outlineParent(entries, index);
  return parent < 0 ? null : moveOutlineBranch(entries, id, entries[parent].id, "after");
}
export function shiftOutlineBranch(entries: OutlineEntry[], id: string, direction: -1 | 1): OutlineEntry[] | null {
  const index = entries.findIndex((entry) => entry.id === id);
  if (index < 0) return null;
  if (direction === 1) {
    const next = outlineBranchEnd(entries, index);
    if (next >= entries.length || entries[next].depth !== entries[index].depth) return null;
    return moveOutlineBranch(entries, id, entries[next].id, "after");
  }
  let previous = index - 1;
  while (previous >= 0 && entries[previous].depth > entries[index].depth) previous--;
  if (previous < 0 || entries[previous].depth !== entries[index].depth) return null;
  return moveOutlineBranch(entries, id, entries[previous].id, "before");
}
export function insertOutlineEntry(entries: OutlineEntry[], id: string | null, child = false): { entries: OutlineEntry[]; focusId: string } {
  const index = entries.findIndex((entry) => entry.id === id);
  const entry = createOutlineEntry(index < 0 ? 0 : entries[index].depth + (child ? 1 : 0));
  const insert = index < 0 ? entries.length : child ? index + 1 : outlineBranchEnd(entries, index);
  return { entries: [...entries.slice(0, insert), entry, ...entries.slice(insert)], focusId: entry.id };
}
export function removeOutlineBranch(entries: OutlineEntry[], id: string): { entries: OutlineEntry[]; focusId: string | null } {
  const index = entries.findIndex((entry) => entry.id === id);
  if (index < 0) return { entries, focusId: null };
  const next = [...entries.slice(0, index), ...entries.slice(outlineBranchEnd(entries, index))];
  return { entries: next, focusId: next[Math.min(Math.max(0, index - 1), next.length - 1)]?.id ?? null };
}
export function pasteOutlineEntries(entries: OutlineEntry[], id: string, source: string): { entries: OutlineEntry[]; focusId: string } | null {
  const parsed = parseHierarchy(source);
  if (parsed.error || !parsed.nodes.length) return null;
  const index = entries.findIndex((entry) => entry.id === id);
  if (index < 0) return null;
  const pasted = parsed.nodes.map((entry) => createOutlineEntry(entries[index].depth + entry.depth, entry.name, entry.quantity));
  const replace = !entries[index].name.trim() && outlineBranchEnd(entries, index) === index + 1;
  const insert = replace ? index : outlineBranchEnd(entries, index);
  return {
    entries: [...entries.slice(0, insert), ...pasted, ...entries.slice(insert + (replace ? 1 : 0))],
    focusId: pasted[0].id,
  };
}
