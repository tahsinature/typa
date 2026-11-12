import { describe, expect, it } from "vitest";
import { parseHierarchy } from "../hierarchy";
import { layoutBalancedHierarchy } from "../hierarchy-layout";

function guestOutline() {
  return [0, 2, 4, 4, 3, 5, 2, 9]
    .map((size, index) => `- Group ${index + 1}\n${Array.from({ length: size }, (_, child) => `    ${child + 1}. Member ${child + 1}`).join("\n")}`)
    .join("\n");
}
function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

describe("balanced hierarchy layout", () => {
  it.each([72, 88])("fits a 37-entry guest list close to square at height %s", (height) => {
    const tree = parseHierarchy(guestOutline());
    const original = JSON.stringify(tree);
    const result = layoutBalancedHierarchy(tree.nodes, tree.roots, "overview", height);
    expect(result.nodes).toHaveLength(38);
    expect(result.edges).toHaveLength(37);
    expect(result.groups).toHaveLength(8);
    const ratio = result.bounds.width / result.bounds.height;
    expect(ratio).toBeGreaterThan(0.8);
    expect(ratio).toBeLessThan(1.25);
    expect(JSON.stringify(tree)).toBe(original);
  });
  it.each(["forest", "single root", "deep tree"])("preserves nodes and relationships for %s", (example) => {
    const source =
      example === "forest"
        ? guestOutline()
        : example === "single root"
          ? "Company\n  Design\n    Alex\n    Sam\n  Engineering\n    Platform\n      Robin\n    Web\n      Casey"
          : Array.from({ length: 64 }, (_, index) => " ".repeat(index) + `Level ${index}`).join("\n");
    const tree = parseHierarchy(source);
    const result = layoutBalancedHierarchy(tree.nodes, tree.roots, "overview");
    expect(new Set(result.nodes.map((node) => node.id))).toEqual(new Set(["overview", ...tree.nodes.map((node) => node.id)]));
    for (const node of tree.nodes) expect(result.edges.find((edge) => edge.target === node.id)?.source).toBe(node.parentId ?? "overview");
    const cards = result.nodes.map((node) => ({ x: node.position.x, y: node.position.y, width: 244, height: 88 }));
    cards.forEach((card, index) => {
      expect(card.x).toBeGreaterThanOrEqual(0);
      expect(card.y).toBeGreaterThanOrEqual(0);
      expect(card.x + card.width).toBeLessThanOrEqual(result.bounds.width);
      expect(card.y + card.height).toBeLessThanOrEqual(result.bounds.height);
      for (const other of cards.slice(index + 1)) expect(overlaps(card, other)).toBe(false);
    });
    result.groups.forEach((group, index) => {
      for (const other of result.groups.slice(index + 1)) expect(overlaps(group, other)).toBe(false);
    });
  });
  it("wraps a large group into multiple member columns", () => {
    const tree = parseHierarchy("Family\n" + Array.from({ length: 25 }, (_, index) => `  Person ${index}`).join("\n") + "\nSolo");
    const result = layoutBalancedHierarchy(tree.nodes, tree.roots, "overview");
    const members = result.nodes.filter((node) => node.entry?.parentId === tree.roots[0]);
    expect(new Set(members.map((node) => node.position.x)).size).toBeGreaterThan(1);
    expect(result.bounds.height).toBeLessThan(25 * 88);
  });
  it("supports collapsed branches and matching paths without inventing parents", () => {
    const tree = parseHierarchy("Team\n  Group\n    Person\nOther\n  Friend");
    for (const ids of [
      ["entry-0", "entry-3"],
      ["entry-0", "entry-1", "entry-2"],
    ]) {
      const visible = tree.nodes.filter((node) => ids.includes(node.id));
      const result = layoutBalancedHierarchy(visible, tree.roots, "overview");
      expect(result.nodes).toHaveLength(visible.length + 1);
      expect(result.edges.every((edge) => result.nodes.some((node) => node.id === edge.source))).toBe(true);
    }
  });
  it("handles empty and single-entry lists", () => {
    expect(layoutBalancedHierarchy([], [], "overview").nodes).toEqual([]);
    const tree = parseHierarchy("One");
    const result = layoutBalancedHierarchy(tree.nodes, tree.roots, "overview");
    expect(result.nodes).toHaveLength(2);
    expect(result.groups).toHaveLength(1);
  });
  it("packs hundreds of independent entries without stretching the board into a strip", () => {
    const tree = parseHierarchy(Array.from({ length: 500 }, (_, index) => `Entry ${index}`).join("\n"));
    const result = layoutBalancedHierarchy(tree.nodes, tree.roots, "overview");
    expect(result.nodes).toHaveLength(501);
    expect(result.bounds.width / result.bounds.height).toBeGreaterThan(0.8);
    expect(result.bounds.width / result.bounds.height).toBeLessThan(1.25);
  });
});
