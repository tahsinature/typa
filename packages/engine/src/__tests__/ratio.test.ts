import { describe, expect, it } from "vitest";
import "../transforms";
import { getTransform, searchTransforms } from "../transforms/registry";
import { readRatio, simplify } from "../transforms/ratio-calculations";

describe("ratio calculations", () => {
  it("is discoverable and defaults to the interactive workspace", () => {
    const transform = getTransform("ratio-proportion")!;
    expect(searchTransforms("aspect ratio")).toContain(transform);
    expect(transform.outputViews[0]).toBe("ratio-workspace");
  });

  it.each([
    ["35 mm × 45 mm", "7:9"],
    ["35x45mm", "7:9"],
    ["1920:1080", "16:9"],
    ["1.5:2.5", "3:5"],
    ["0.000001:0.000002", "1:2"],
    ["2:3:5", "2:3:5"],
    ["0:4", "0:1"],
  ])("simplifies %s exactly", (input, expected) => {
    expect(simplify(readRatio(input))).toBe(expected);
  });

  it.each([
    ["35 mm:4.5 cm", "same unit"],
    ["0:0", "greater than zero"],
    ["-2:3", "Enter numbers"],
    ["2:NaN", "Enter numbers"],
    ["2:Infinity", "Enter numbers"],
    ["0.0000001:2", "Enter numbers"],
    ["999999999999:2", "too large"],
    ["2", "at least two"],
  ])("rejects invalid ratio %s", (input, message) => {
    expect(() => readRatio(input)).toThrow(message);
  });
});
