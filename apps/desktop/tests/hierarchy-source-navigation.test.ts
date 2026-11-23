import { describe, expect, it } from "bun:test";
import { getNodeSourceRange } from "../src/viewers/hierarchy-tree/source-navigation";

function selected(source: string, id: string) {
  const range = getNodeSourceRange(source, id);
  return range && source.slice(range.start, range.end);
}

describe("hierarchy source navigation", () => {
  it("locates repeated outline names by node position, skipping blank lines and markers", () => {
    const source = "Root\r\n\r\n  - [x] <> :: 2\r\n  - <>\r\n";
    expect(selected(source, "entry-1")).toBe("<>");
    expect(selected(source, "entry-2")).toBe("<>");
    expect(getNodeSourceRange(source, "entry-2")?.start).toBe(source.lastIndexOf("<>"));
  });

  it("uses hierarchy order even when JSON children appear before their parent's name", () => {
    const source = '{"children":["same",{"name":"same"}],"name":"same"}';
    expect(getNodeSourceRange(source, "entry-0")?.start).toBe(source.lastIndexOf('"same"') + 1);
    expect(getNodeSourceRange(source, "entry-1")?.start).toBe(source.indexOf('"same"') + 1);
    expect(getNodeSourceRange(source, "entry-2")?.start).toBe(source.indexOf('"same"', source.indexOf('"same"') + 1) + 1);
  });

  it("honors label aliases, escaped strings, and unrelated JSON properties", () => {
    const source = JSON.stringify([{ metadata: { name: "ignored" }, name: null, label: 'A "quote"', children: [{ title: "Child" }] }]);
    expect(selected(source, "entry-0")).toBe('A \\"quote\\"');
    expect(selected(source, "entry-1")).toBe("Child");
  });

  it("does not navigate invalid documents or nonexistent nodes", () => {
    expect(getNodeSourceRange('{"name":', "entry-0")).toBeNull();
    expect(getNodeSourceRange("Root", "entry-9")).toBeNull();
  });
});
