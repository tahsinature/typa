import { describe, expect, it } from "vitest";
import {
  createOutlineEntry,
  readOutlineEntries,
  writeOutlineEntries,
  moveOutlineBranch,
  indentOutlineBranch,
  outdentOutlineBranch,
  shiftOutlineBranch,
  insertOutlineEntry,
  removeOutlineBranch,
  pasteOutlineEntries,
  type OutlineEntry,
} from "../hierarchy-editor";
import { parseHierarchy } from "../hierarchy";

const names = (entries: OutlineEntry[]) => entries.map((entry) => `${entry.depth}:${entry.name}`);
const fixture = () => readOutlineEntries("A\n  B\n    C\n  D\nE\n  F\nG");
function id(entries: OutlineEntry[], name: string) {
  return entries.find((entry) => entry.name === name)!.id;
}
function parents(entries: OutlineEntry[]) {
  const tree = parseHierarchy(writeOutlineEntries(entries));
  return tree.nodes.map((node) => [node.name, tree.nodes.find((parent) => parent.id === node.parentId)?.name ?? null]);
}

describe("structured hierarchy editing", () => {
  it("keeps duplicate names distinct and round-trips quantities", () => {
    const entries = readOutlineEntries("Team\n  Alex\n  Alex :: 3");
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(3);
    expect(parseHierarchy(writeOutlineEntries(entries))).toMatchObject({ leaves: 2, groups: 1, quantity: 4, error: null });
  });
  it("preserves names that contain source syntax", () => {
    const entries = [createOutlineEntry(0, "- [x] Names :: 3"), createOutlineEntry(0, "নানি")];
    expect(parseHierarchy(writeOutlineEntries(entries)).nodes.map((node) => node.name)).toEqual(entries.map((entry) => entry.name));
  });
  it("keeps a blank draft node valid without discarding its children", () => {
    const tree = parseHierarchy(writeOutlineEntries([createOutlineEntry(), createOutlineEntry(1, "Child")]));
    expect(tree.nodes[0]).toMatchObject({ name: "Untitled", nodeCount: 2 });
  });
  it("adds a sibling after the complete current branch", () => {
    const entries = fixture();
    const result = insertOutlineEntry(entries, id(entries, "B"));
    expect(names(result.entries)).toEqual(["0:A", "1:B", "2:C", "1:", "1:D", "0:E", "1:F", "0:G"]);
    expect(result.entries.find((entry) => entry.id === result.focusId)?.depth).toBe(1);
  });
  it("adds a first child or a new root", () => {
    const entries = fixture();
    expect(names(insertOutlineEntry(entries, id(entries, "A"), true).entries)).toEqual(["0:A", "1:", "1:B", "2:C", "1:D", "0:E", "1:F", "0:G"]);
    expect(insertOutlineEntry(entries, null).entries.slice(-1)[0]?.depth).toBe(0);
    expect(insertOutlineEntry([], null).entries).toHaveLength(1);
  });
  it("indents a whole branch under the previous sibling", () => {
    const entries = fixture();
    const result = indentOutlineBranch(entries, id(entries, "E"))!;
    expect(names(result)).toEqual(["0:A", "1:B", "2:C", "1:D", "1:E", "2:F", "0:G"]);
    expect(parents(result)).toContainEqual(["F", "E"]);
  });
  it("does not indent a first child or the first root", () => {
    const entries = fixture();
    expect(indentOutlineBranch(entries, id(entries, "A"))).toBeNull();
    expect(indentOutlineBranch(entries, id(entries, "B"))).toBeNull();
  });
  it("outdents after the old parent's remaining children, preserving their parent", () => {
    const entries = fixture();
    const result = outdentOutlineBranch(entries, id(entries, "B"))!;
    expect(names(result)).toEqual(["0:A", "1:D", "0:B", "1:C", "0:E", "1:F", "0:G"]);
    expect(parents(result)).toContainEqual(["D", "A"]);
    expect(parents(result)).toContainEqual(["C", "B"]);
    expect(outdentOutlineBranch(entries, id(entries, "A"))).toBeNull();
  });
  it("swaps entire sibling branches in either direction", () => {
    const entries = fixture();
    const down = shiftOutlineBranch(entries, id(entries, "B"), 1)!;
    expect(names(down)).toEqual(["0:A", "1:D", "1:B", "2:C", "0:E", "1:F", "0:G"]);
    expect(shiftOutlineBranch(down, id(entries, "B"), -1)).toEqual(entries);
    expect(shiftOutlineBranch(entries, id(entries, "D"), 1)).toBeNull();
  });
  it.each(["before", "after", "inside"] as const)("moves branches %s a target while keeping descendant identity", (placement) => {
    const entries = fixture();
    const result = moveOutlineBranch(entries, id(entries, "B"), id(entries, "E"), placement)!;
    expect(new Set(result.map((entry) => entry.id))).toEqual(new Set(entries.map((entry) => entry.id)));
    expect(parents(result)).toContainEqual(["C", "B"]);
    expect(parents(result)).toContainEqual(["F", "E"]);
    expect(parents(result)).toContainEqual(["B", placement === "inside" ? "E" : null]);
  });
  it("rejects dragging into self or descendants", () => {
    const entries = fixture();
    for (const target of ["A", "B", "C", "D"]) {
      for (const placement of ["before", "inside", "after"] as const) expect(moveOutlineBranch(entries, id(entries, "A"), id(entries, target), placement)).toBeNull();
    }
  });
  it("removes exactly the selected branch and chooses a surviving focus target", () => {
    const entries = fixture();
    const result = removeOutlineBranch(entries, id(entries, "B"));
    expect(names(result.entries)).toEqual(["0:A", "1:D", "0:E", "1:F", "0:G"]);
    expect(result.focusId).toBe(id(entries, "A"));
    const singleton = [createOutlineEntry(0, "Only")];
    expect(removeOutlineBranch(singleton, singleton[0].id)).toEqual({ entries: [], focusId: null });
  });
  it("pastes a nested list as sibling branches with the current depth", () => {
    const entries = fixture();
    const result = pasteOutlineEntries(entries, id(entries, "B"), "1. Guests\n  - Alex\n  - Sam :: 2")!;
    expect(names(result.entries)).toEqual(["0:A", "1:B", "2:C", "1:Guests", "2:Alex", "2:Sam", "1:D", "0:E", "1:F", "0:G"]);
    expect(result.entries.find((entry) => entry.name === "Sam")?.quantity).toBe(2);
  });
  it("replaces an empty leaf on paste and supports JSON", () => {
    const blank = createOutlineEntry();
    const result = pasteOutlineEntries([blank], blank.id, '{"name":"Team","children":["Alex","Sam"]}')!;
    expect(names(result.entries)).toEqual(["0:Team", "1:Alex", "1:Sam"]);
    expect(pasteOutlineEntries([blank], blank.id, "{broken")).toBeNull();
  });
  it("enforces depth limits for branch moves and serialization", () => {
    const entries = readOutlineEntries(Array.from({ length: 64 }, (_, i) => " ".repeat(i) + `Level ${i}`).join("\n") + "\nOther");
    expect(moveOutlineBranch(entries, id(entries, "Other"), id(entries, "Level 63"), "inside")).toBeNull();
    expect(() => writeOutlineEntries([createOutlineEntry(1, "Orphan")])).toThrow();
    expect(() => writeOutlineEntries([createOutlineEntry(0, "A"), createOutlineEntry(2, "Gap")])).toThrow();
  });
  it("does not mutate the original entries when editing relationships", () => {
    const entries = fixture();
    const original = JSON.stringify(entries);
    indentOutlineBranch(entries, id(entries, "E"));
    outdentOutlineBranch(entries, id(entries, "B"));
    shiftOutlineBranch(entries, id(entries, "A"), 1);
    removeOutlineBranch(entries, id(entries, "A"));
    pasteOutlineEntries(entries, id(entries, "B"), "Someone");
    expect(JSON.stringify(entries)).toBe(original);
  });
});
