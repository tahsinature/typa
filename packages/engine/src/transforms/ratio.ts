import { registerTransform } from "./registry";
import { evaluateRatioWorkspace, readRatioWorkspace } from "../ratio-workspace";

registerTransform({
  id: "ratio-proportion",
  name: "Ratio & Proportion",
  description:
    "Simplify ratios and aspect ratios, scale dimensions, solve proportions, split totals, and calculate percentage shares",
  category: "Numbers",
  inputViews: [],
  outputViews: ["ratio-workspace", "raw-output"],
  tips: [
    "Choose a calculation tab and edit its fields. Example buttons fill in common scenarios.",
    "Lock dimensions to resize proportionally. Units label the values; they do not convert them.",
    "Percentage shares divide each part by the total. Compare two values divides the first by the second.",
    "Use non-negative numbers with up to six decimal places. Results are displayed with up to 12 significant digits.",
  ],
  fn: (input) => {
    const result = evaluateRatioWorkspace(readRatioWorkspace(input));
    return { text: result.text, data: result };
  },
});
