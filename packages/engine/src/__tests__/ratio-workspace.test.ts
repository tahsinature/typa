import { describe, expect, it } from "vitest";
import {
  createRatioWorkspace,
  evaluateRatioWorkspace,
  readRatioWorkspace,
  resizeRatioDimension,
} from "../ratio-workspace";
import "../transforms/ratio";
import { getTransform } from "../transforms/registry";

describe("interactive ratio workspace", () => {
  it("starts with a simplified ratio and exposes meaningful copyable output", async () => {
    const result = await getTransform("ratio-proportion")!.fn("");
    expect(result).toMatchObject({ text: expect.stringContaining("Ratio: 7:9"), data: { headline: "7:9" } });
  });

  it("round-trips independent fields and selected mode through tab input", () => {
    const state = createRatioWorkspace();
    state.mode = "split";
    state.total = "500";
    state.dimensions.width = "700";
    expect(readRatioWorkspace(JSON.stringify(state))).toEqual(state);
  });

  it("keeps previously entered text ratios", () => {
    expect(evaluateRatioWorkspace(readRatioWorkspace("1920 × 1080")).headline).toBe("16:9");
  });

  it.each(["{}", "{broken", '{"version":1,"mode":"invalid"}', "unrelated text"])("recovers safely from %s", (input) => {
    expect(readRatioWorkspace(input)).toEqual(createRatioWorkspace());
  });

  it("scales either dimension while locked and allows free editing when unlocked", () => {
    const dimensions = createRatioWorkspace().dimensions;
    expect(resizeRatioDimension(dimensions, "width", "700")).toMatchObject({ width: "700", height: "900" });
    expect(resizeRatioDimension(dimensions, "height", "900")).toMatchObject({ width: "700", height: "900" });
    expect(resizeRatioDimension({ ...dimensions, locked: false }, "width", "700")).toMatchObject({
      width: "700",
      height: "45",
    });
    expect(resizeRatioDimension(dimensions, "width", "")).toMatchObject({ width: "", height: "45" });
  });

  it("reports physical dimensions with their selected unit", () => {
    const state = createRatioWorkspace();
    state.mode = "scale";
    expect(evaluateRatioWorkspace(state)).toMatchObject({
      headline: "7:9",
      text: expect.stringContaining("Width: 35 mm"),
    });
  });

  it("keeps the locked ratio when a field is cleared and retyped", () => {
    let dimensions = createRatioWorkspace().dimensions;
    for (const value of ["", "7", "70", "700"]) dimensions = resizeRatioDimension(dimensions, "width", value);
    expect(dimensions).toMatchObject({ width: "700", height: "900" });
    dimensions = resizeRatioDimension(dimensions, "height", "45");
    expect(dimensions).toMatchObject({ width: "35", height: "45" });
  });

  it.each([0, 1, 2, 3])("solves any of the four proportion fields (unknown %s)", (unknown) => {
    const state = createRatioWorkspace();
    state.mode = "proportion";
    state.proportion.unknown = unknown;
    expect(evaluateRatioWorkspace(state).headline).toBe(state.proportion.values[unknown]);
  });

  it("splits a total using named parts and preserves zero weights", () => {
    const state = createRatioWorkspace();
    state.mode = "split";
    state.parts = [
      { id: "a", name: "Alex", value: "2" },
      { id: "b", name: "Sam", value: "3" },
      { id: "c", name: "Jo", value: "0" },
    ];
    expect(evaluateRatioWorkspace(state)).toMatchObject({
      values: [48, 72, 0],
      shares: [40, 60, 0],
      text: expect.stringContaining("Alex: 48"),
    });
  });

  it("distinguishes shares of a total from comparisons, including values above 100%", () => {
    const state = createRatioWorkspace();
    state.mode = "shares";
    state.parts[0].value = "2";
    state.parts[1].value = "3";
    expect(evaluateRatioWorkspace(state).shares).toEqual([40, 60]);
    state.percentage.kind = "comparison";
    expect(evaluateRatioWorkspace(state).headline).toBe("66.6666666667%");
    state.percentage.first = "150";
    state.percentage.second = "100";
    expect(evaluateRatioWorkspace(state).headline).toBe("150%");
    state.percentage.second = "0";
    expect(evaluateRatioWorkspace(state).error).toContain("greater than zero");
  });

  it("returns validation instead of stale or non-finite results while editing", () => {
    const state = createRatioWorkspace();
    state.parts[0].value = "";
    expect(evaluateRatioWorkspace(state).error).toBeDefined();
    state.mode = "scale";
    state.dimensions.width = "0";
    expect(evaluateRatioWorkspace(state).error).toContain("greater than zero");
    state.mode = "proportion";
    state.proportion.values[0] = "0";
    expect(evaluateRatioWorkspace(state).error).toContain("greater than zero");
  });
});
