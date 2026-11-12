import { describe, expect, it } from "vitest";
import { hierarchyToJson, parseHierarchy } from "../hierarchy";
import "../transforms/hierarchy";
import { getTransform } from "../transforms/registry";

describe("hierarchy outlines", () => {
  it("accepts mixed bullets and numbered children with unfinished trailing markers", () => {
    const sizes = [0, 2, 4, 4, 3, 5, 2, 9];
    const source =
      sizes.map((size, group) => `- Group ${group + 1}\n${Array.from({ length: size }, (_, child) => `    ${child + 1}. Member ${child + 1}`).join("\n")}`).join("\n") +
      "\n-\n1. \n- [ ] ";
    expect(parseHierarchy(source)).toMatchObject({ leaves: 30, groups: 7, error: null });
    expect(parseHierarchy(source).nodes).toHaveLength(37);
    expect(parseHierarchy("-\n- [ ]\n1.").nodes).toEqual([]);
  });
  it("counts groups separately from leaves across a forest", () => {
    const result = parseHierarchy("Solo\nFamily\n  Alex\n  Sam\nTeam\n  Web\n    Jo\n  Platform");
    expect(result).toMatchObject({ error: null, leaves: 5, groups: 3, depth: 3, quantity: 5 });
    expect(result.nodes).toHaveLength(8);
    expect(result.roots).toHaveLength(3);
    expect(result.nodes[5]).toMatchObject({ name: "Web", leafCount: 1, nodeCount: 2, depth: 1 });
    expect(result.nodes[1]).toMatchObject({ name: "Family", leafCount: 2, nodeCount: 3 });
  });

  it("accepts numbered lists, bullets, task lists, tabs, CRLF, and common indentation", () => {
    const result = parseHierarchy("    1. Family\r\n\t\t- [x] Alex\r\n\t\t* [ ] Sam\r\n\r\n    2) Solo");
    expect(result.nodes.map((node) => node.name)).toEqual(["Family", "Alex", "Sam", "Solo"]);
    expect(result).toMatchObject({ leaves: 3, groups: 1, depth: 2, error: null });
    expect(result.nodes[2].line).toBe(3);
  });

  it("preserves punctuation, Unicode, duplicate names, and input order", () => {
    const result = parseHierarchy("Friends\n  abrar*-\n  নানি\n  Alex\n  Alex\nOther\n  Alex");
    expect(result.leaves).toBe(5);
    const duplicates = result.nodes.filter((node) => node.name === "Alex");
    expect(new Set(duplicates.map((node) => node.id)).size).toBe(3);
    expect(duplicates.map((node) => node.branch)).toEqual([0, 0, 1]);
    expect(result.nodes[1].name).toBe("abrar*-");
  });

  it("uses indentation rather than numbering to establish parents", () => {
    const result = parseHierarchy("1. A\n    99. B\n        C\n  2. D\n3. E");
    expect(result.nodes.map((node) => node.parentId)).toEqual([null, "entry-0", "entry-1", "entry-0", null]);
    expect(result.nodes[0]).toMatchObject({ leafCount: 2, nodeCount: 4 });
  });

  it("sums quantities on leaves, excluding group quantities and allowing zero", () => {
    const result = parseHierarchy("Dinner :: 100\n  Table 1\n    Adults :: 6\n    Kids :: 3\n  Table 2\n    Adults :: 8\n    Spare seats :: 0\nStaff :: 2.5");
    expect(result).toMatchObject({ leaves: 5, groups: 3, quantity: 19.5 });
    expect(result.nodes[0]).toMatchObject({ quantity: 100, quantityTotal: 17, leafCount: 4, nodeCount: 7 });
  });

  it.each(["Kids ::", "Kids :: -3", "Kids :: many", "Kids :: Infinity", "Kids :: 9007199254740992"])("reports invalid entries without partial counts: %s", (source) => {
    const result = parseHierarchy(`Valid\n${source}`);
    expect(result.error).toBeTruthy();
    expect(result.nodes).toEqual([]);
    expect(result.leaves).toBe(0);
  });

  it("returns a genuinely empty hierarchy for empty or whitespace-only source", () => {
    expect(parseHierarchy("\n \t\n")).toMatchObject({ nodes: [], roots: [], leaves: 0, groups: 0, error: null });
  });

  it("supports 5,000 entries, rejects excess, and limits nesting safely", () => {
    expect(parseHierarchy(Array.from({ length: 5000 }, (_, i) => `Person ${i}`).join("\n")).nodes).toHaveLength(5000);
    expect(parseHierarchy(Array.from({ length: 5001 }, (_, i) => `Person ${i}`).join("\n")).error).toContain("5,000");
    expect(parseHierarchy(Array.from({ length: 64 }, (_, i) => " ".repeat(i) + `Level ${i}`).join("\n")).depth).toBe(64);
    expect(parseHierarchy(Array.from({ length: 65 }, (_, i) => " ".repeat(i) + `Level ${i}`).join("\n")).error).toContain("64");
  });

  it("rejects quantity totals beyond the safe numeric range", () => {
    expect(parseHierarchy("Group\n  One :: 9007199254740991\n  Two :: 1").error).toContain("too large");
  });
});

describe("hierarchy JSON", () => {
  it("accepts a node, forest, string leaves, aliases, and empty children", () => {
    const tree = parseHierarchy(JSON.stringify([{ label: "Team", children: ["Alex", { title: "Sam", quantity: 3, children: [] }] }, "Solo"]));
    expect(tree).toMatchObject({ format: "json", leaves: 3, groups: 1, quantity: 5, error: null });
    expect(tree.nodes.map((node) => node.name)).toEqual(["Team", "Alex", "Sam", "Solo"]);
    expect(parseHierarchy('{"name":"Only"}').leaves).toBe(1);
    expect(parseHierarchy("[]").nodes).toEqual([]);
  });

  it.each(["{broken", "{}", "[null]", "[2]", '{"name":2}', '{"name":"Team","children":{}}', '{"name":"Team","quantity":"2"}', '{"name":"Team","quantity":-1}'])(
    "validates malformed JSON: %s",
    (source) => {
      expect(parseHierarchy(source).error).toBeTruthy();
    },
  );

  it("round-trips every original entry and quantity through portable JSON", () => {
    const tree = parseHierarchy("Group :: 5\n  Alex\n  Alex :: 3\nOther");
    const exported = hierarchyToJson(tree);
    expect(exported).not.toContain("leafCount");
    expect(JSON.parse(exported)).toEqual([{ name: "Group", quantity: 5, children: [{ name: "Alex" }, { name: "Alex", quantity: 3 }] }, { name: "Other" }]);
    expect(parseHierarchy(exported).nodes.map(({ line, ...node }) => node)).toEqual(tree.nodes.map(({ line, ...node }) => node));
  });

  it("registers a workspace tool with copyable JSON and structured output", async () => {
    const transform = getTransform("hierarchy-tree")!;
    expect(transform.inputViews).toEqual([]);
    const result = await transform.fn("Team\n  Alex\n  Sam");
    expect(result).toMatchObject({ data: { leaves: 2, groups: 1, error: null } });
    expect(JSON.parse((result as { text: string }).text)).toEqual([{ name: "Team", children: [{ name: "Alex" }, { name: "Sam" }] }]);
  });
});
