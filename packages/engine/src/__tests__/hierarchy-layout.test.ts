import { describe, expect, it } from "vitest";
import { parseHierarchy } from "../hierarchy";
import { layoutBalancedHierarchy, type BoardCard } from "../hierarchy-layout";

const metrics = { nodeHeight: 64, headerHeight: 44, rowHeight: 26 };
function guestOutline() {
  return [0, 2, 4, 4, 3, 5, 2, 9]
    .map((size, index) => `- Group ${index + 1}\n${Array.from({ length: size }, (_, child) => `    ${child + 1}. Member ${child + 1}`).join("\n")}`)
    .join("\n");
}
function rect(card: BoardCard) {
  return { x: card.position.x, y: card.position.y, width: card.width, height: card.height };
}
function overlaps(a: ReturnType<typeof rect>, b: ReturnType<typeof rect>) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
function shownIds(cards: BoardCard[]) {
  return cards.flatMap((card) => [
    card.id,
    ...card.sections.flatMap((section) => [...(section.heading ? [section.heading.id] : []), ...section.columns.flat().map((entry) => entry.id)]),
  ]);
}

describe("balanced hierarchy board", () => {
  it("turns each top-level group into one card and keeps the board close to square", () => {
    const tree = parseHierarchy(guestOutline());
    const original = JSON.stringify(tree);
    const result = layoutBalancedHierarchy(tree.nodes, tree.roots, "overview", metrics);
    expect(result.cards.filter((card) => card.kind === "card")).toHaveLength(8);
    expect(result.cards[0].kind).toBe("overview");
    const ratio = result.bounds.width / result.bounds.height;
    expect(ratio).toBeGreaterThan(0.6);
    expect(ratio).toBeLessThan(1.6);
    expect(JSON.stringify(tree)).toBe(original);
  });
  it.each(["forest", "single root", "deep tree"])("shows every entry exactly once without overlaps for %s", (example) => {
    const source =
      example === "forest"
        ? guestOutline()
        : example === "single root"
          ? "Company\n  Design\n    Alex\n    Sam\n  Engineering\n    Platform\n      Robin\n    Web\n      Casey"
          : Array.from({ length: 64 }, (_, index) => " ".repeat(index) + `Level ${index}`).join("\n");
    const tree = parseHierarchy(source);
    const result = layoutBalancedHierarchy(tree.nodes, tree.roots, "overview", metrics);
    const ids = shownIds(result.cards);
    expect(ids.sort()).toEqual(["overview", ...tree.nodes.map((node) => node.id)].sort());
    const rects = result.cards.map(rect);
    rects.forEach((card, index) => {
      expect(card.x).toBeGreaterThanOrEqual(0);
      expect(card.y).toBeGreaterThanOrEqual(0);
      expect(card.x + card.width).toBeLessThanOrEqual(result.bounds.width);
      expect(card.y + card.height).toBeLessThanOrEqual(result.bounds.height);
      for (const other of rects.slice(index + 1)) expect(overlaps(card, other)).toBe(false);
    });
  });
  it("uses a header card for a single root and lists nested rows in order", () => {
    const tree = parseHierarchy("Company\n  Design\n    Alex\n    Sam\n  Engineering\n    Platform\n      Robin");
    const result = layoutBalancedHierarchy(tree.nodes, tree.roots, "overview", metrics);
    expect(result.cards.map((card) => card.kind)).toEqual(["overview", "header", "card", "card"]);
    const engineering = result.cards.find((card) => card.entry?.name === "Engineering")!;
    expect(engineering.sections.map((section) => [section.heading?.name, ...section.columns.flat().map((entry) => entry.name)])).toEqual([["Platform", "Robin"]]);
    expect(engineering.height).toBe(metrics.headerHeight + 2 * metrics.rowHeight + 12);
  });
  it("lists direct leaves first, then one balanced section per sub-group", () => {
    const children = Array.from({ length: 30 }, (_, index) => `    Child ${index}`).join("\n");
    const tree = parseHierarchy(`Family\n  Abbu\n  Chakaria\n${children}\n  Amma\nFriends\n  Sam`);
    const result = layoutBalancedHierarchy(tree.nodes, tree.roots, "overview", metrics);
    const family = result.cards.find((card) => card.entry?.name === "Family")!;
    expect(family.sections.map((section) => section.heading?.name ?? null)).toEqual([null, "Chakaria"]);
    expect(family.sections[0].columns.flat().map((entry) => entry.name)).toEqual(["Abbu", "Amma"]);
    const lengths = family.sections[1].columns.map((column) => column.length);
    expect(lengths.length).toBeGreaterThan(1);
    expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(1);
    expect(family.width).toBeGreaterThan(244);
  });
  it("only lists the entries it is given", () => {
    const tree = parseHierarchy("Team\n  Group\n    Person\nOther\n  Friend");
    const visible = tree.nodes.filter((node) => ["entry-0", "entry-3"].includes(node.id));
    const result = layoutBalancedHierarchy(visible, tree.roots, "overview", metrics);
    expect(shownIds(result.cards).sort()).toEqual(["entry-0", "entry-3", "overview"]);
    expect(result.cards.every((card) => card.height === (card.kind === "card" ? metrics.headerHeight : metrics.nodeHeight))).toBe(true);
  });
  it("handles empty and single-entry lists", () => {
    expect(layoutBalancedHierarchy([], [], "overview", metrics).cards).toEqual([]);
    const tree = parseHierarchy("One");
    expect(layoutBalancedHierarchy(tree.nodes, tree.roots, "overview", metrics).cards).toHaveLength(2);
  });
  it("packs hundreds of independent entries without stretching the board into a strip", () => {
    const tree = parseHierarchy(Array.from({ length: 500 }, (_, index) => `Entry ${index}`).join("\n"));
    const result = layoutBalancedHierarchy(tree.nodes, tree.roots, "overview", metrics);
    expect(result.cards).toHaveLength(501);
    expect(result.bounds.width / result.bounds.height).toBeGreaterThan(0.8);
    expect(result.bounds.width / result.bounds.height).toBeLessThan(1.25);
  });
});
