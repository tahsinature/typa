import { describe, expect, it } from "vitest";
import { parseHierarchy } from "../hierarchy";
import { hierarchyToBullets } from "../hierarchy-bullets";

describe("hierarchy bullet exports", () => {
  it("includes every nested entry in source order and preserves quantities", () => {
    const tree = parseHierarchy("Family\n  Household\n    Alex :: 3\n    Sam\n  Jo\nSolo :: 0");
    expect(tree.nodes[0].leafCount).toBe(3);
    expect(tree.nodes[1].leafCount).toBe(2);
    const result = hierarchyToBullets(tree);
    expect(result.markdown).toBe("- Family\n    - Household\n        - Alex :: 3\n        - Sam\n    - Jo\n- Solo :: 0");
    expect(result.html).toBe("<ul><li>Family<ul><li>Household<ul><li>Alex :: 3</li><li>Sam</li></ul></li><li>Jo</li></ul></li><li>Solo :: 0</li></ul>");
    expect(parseHierarchy(result.markdown).quantity).toBe(tree.quantity);
  });

  it("escapes HTML and Markdown markup while retaining duplicate and Unicode labels", () => {
    const tree = parseHierarchy(JSON.stringify([{ name: '<img src=x onerror="alert(1)"> & **Name**', children: ["নানি", "নানি"] }]));
    const result = hierarchyToBullets(tree);
    expect(result.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; **Name**");
    expect(result.html).not.toContain("<img");
    expect(result.markdown).toContain('\\<img src=x onerror="alert(1)"\\> & \\*\\*Name\\*\\*');
    expect(result.html.match(/<li>নানি<\/li>/g)).toHaveLength(2);
  });

  it("normalizes multiline JSON labels and supports the maximum nesting depth", () => {
    expect(hierarchyToBullets(parseHierarchy('{"name":"Line 1\\nLine 2"}')).markdown).toBe("- Line 1 Line 2");
    const tree = parseHierarchy(Array.from({ length: 64 }, (_, depth) => `${" ".repeat(depth)}Level ${depth}`).join("\n"));
    expect(hierarchyToBullets(tree).html.match(/<li>/g)).toHaveLength(64);
  });

  it("does not export partial or invalid outlines", () => {
    expect(hierarchyToBullets(parseHierarchy(""))).toEqual({ markdown: "", html: "" });
    expect(hierarchyToBullets(parseHierarchy("{broken"))).toEqual({ markdown: "", html: "" });
  });
});
