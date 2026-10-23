import type { RatioMode, RatioWorkspace } from "@typa/engine";

interface Example {
  label: string;
  patch: Partial<RatioWorkspace>;
}
const parts = (names: string[], values: string[]) =>
  names.map((name, i) => ({ id: `example-${i}`, name, value: values[i] }));

export const examples: Record<RatioMode, Example[]> = {
  simplify: [
    { label: "35 × 45 photo", patch: { parts: parts(["Width (mm)", "Height (mm)"], ["35", "45"]) } },
    { label: "Widescreen", patch: { parts: parts(["Width (px)", "Height (px)"], ["1920", "1080"]) } },
    { label: "Recipe mix", patch: { parts: parts(["Flour", "Water", "Starter"], ["500", "350", "100"]) } },
  ],
  scale: [
    { label: "35 × 45 photo", patch: { dimensions: { width: "35", height: "45", unit: "mm", locked: true } } },
    { label: "HD video", patch: { dimensions: { width: "1920", height: "1080", unit: "px", locked: true } } },
    { label: "Square", patch: { dimensions: { width: "1080", height: "1080", unit: "px", locked: true } } },
  ],
  proportion: [
    { label: "Recipe servings", patch: { proportion: { values: ["250", "4", "437.5", "7"], unknown: 2 } } },
    { label: "Unit price", patch: { proportion: { values: ["12", "3", "4", "1"], unknown: 2 } } },
    { label: "Map scale", patch: { proportion: { values: ["1", "50000", "3", "150000"], unknown: 3 } } },
  ],
  split: [
    { label: "Shared budget", patch: { total: "120", parts: parts(["Alex", "Sam"], ["2", "3"]) } },
    { label: "50 / 30 / 20", patch: { total: "3000", parts: parts(["Needs", "Wants", "Savings"], ["5", "3", "2"]) } },
    { label: "Equal shares", patch: { total: "100", parts: parts(["Alex", "Sam", "Jo"], ["1", "1", "1"]) } },
  ],
  shares: [
    {
      label: "Share of a mix",
      patch: {
        parts: parts(["Part A", "Part B"], ["2", "3"]),
        percentage: { kind: "shares", first: "2", second: "3" },
      },
    },
    { label: "Score: 42 of 50", patch: { percentage: { kind: "comparison", first: "42", second: "50" } } },
    { label: "Beyond 100%", patch: { percentage: { kind: "comparison", first: "150", second: "100" } } },
  ],
};

export const modeInfo = [
  { id: "simplify", label: "Ratios", number: "01" },
  { id: "scale", label: "Dimensions", number: "02" },
  { id: "proportion", label: "Proportions", number: "03" },
  { id: "split", label: "Split a total", number: "04" },
  { id: "shares", label: "Percentages", number: "05" },
] as const;
