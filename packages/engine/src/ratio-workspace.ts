import { format, proportionValue, readNumber, readRatio, simplify } from "./transforms/ratio-calculations";

export type RatioMode = "simplify" | "scale" | "proportion" | "split" | "shares";
export interface RatioPart {
  id: string;
  name: string;
  value: string;
}
export interface RatioWorkspace {
  version: 1;
  mode: RatioMode;
  parts: RatioPart[];
  dimensions: {
    width: string;
    height: string;
    locked: boolean;
    unit: string;
    reference?: { width: string; height: string };
  };
  proportion: { values: string[]; unknown: number };
  total: string;
  percentage: { kind: "shares" | "comparison"; first: string; second: string };
}
export interface RatioWorkspaceResult {
  text: string;
  error?: string;
  headline?: string;
  caption?: string;
  values?: number[];
  shares?: number[];
}

export function createRatioWorkspace(): RatioWorkspace {
  return {
    version: 1,
    mode: "simplify",
    parts: [
      { id: "a", name: "Part A", value: "35" },
      { id: "b", name: "Part B", value: "45" },
    ],
    dimensions: { width: "35", height: "45", locked: true, unit: "mm" },
    proportion: { values: ["250", "4", "437.5", "7"], unknown: 2 },
    total: "120",
    percentage: { kind: "shares", first: "2", second: "3" },
  };
}

export function readRatioWorkspace(input: string): RatioWorkspace {
  const defaults = createRatioWorkspace();
  if (!input.trim()) return defaults;
  try {
    const state = JSON.parse(input) as RatioWorkspace;
    if (state.version !== 1 || !["simplify", "scale", "proportion", "split", "shares"].includes(state.mode))
      return defaults;
    if (!Array.isArray(state.parts) || state.parts.length < 2 || state.parts.length > 12) return defaults;
    if (
      state.parts.some(
        (part) => typeof part.id !== "string" || typeof part.name !== "string" || typeof part.value !== "string",
      )
    )
      return defaults;
    if (new Set(state.parts.map((part) => part.id)).size !== state.parts.length) return defaults;
    if (
      !state.dimensions ||
      typeof state.dimensions.width !== "string" ||
      typeof state.dimensions.height !== "string" ||
      typeof state.dimensions.locked !== "boolean" ||
      !["mm", "cm", "in", "px"].includes(state.dimensions.unit)
    )
      return defaults;
    if (
      !state.proportion ||
      !Array.isArray(state.proportion.values) ||
      state.proportion.values.length !== 4 ||
      state.proportion.values.some((value) => typeof value !== "string") ||
      !Number.isInteger(state.proportion.unknown) ||
      state.proportion.unknown < 0 ||
      state.proportion.unknown > 3
    )
      return defaults;
    if (
      typeof state.total !== "string" ||
      !state.percentage ||
      !["shares", "comparison"].includes(state.percentage.kind) ||
      typeof state.percentage.first !== "string" ||
      typeof state.percentage.second !== "string"
    )
      return defaults;
    return state;
  } catch {
    // Preserve ratios entered before the interactive editor was introduced.
    try {
      const values = readRatio(input);
      if (values.length <= 12)
        defaults.parts = values.map((value, i) => ({ id: String(i), name: `Part ${i + 1}`, value: String(value) }));
    } catch {
      /* Unrelated input starts with the example workspace. */
    }
    return defaults;
  }
}

export function evaluateRatioWorkspace(state: RatioWorkspace): RatioWorkspaceResult {
  try {
    if (state.mode === "scale") {
      const values = readRatio(`${state.dimensions.width}:${state.dimensions.height}`);
      if (values.some((value) => value === 0)) throw new Error("Enter a width and height greater than zero.");
      const ratio = simplify(values);
      return {
        headline: ratio,
        caption: "Width : height",
        values,
        text: `Ratio: ${ratio}\nWidth: ${format(values[0])} ${state.dimensions.unit}\nHeight: ${format(values[1])} ${state.dimensions.unit}`,
      };
    }
    if (state.mode === "proportion") {
      const values = state.proportion.values.map((value, i) =>
        i === state.proportion.unknown ? 0 : readNumber(value),
      );
      if (values.some((value, i) => i !== state.proportion.unknown && value === 0))
        throw new Error("Known values must be greater than zero.");
      const answer = proportionValue(values, state.proportion.unknown);
      const headline = format(answer);
      values[state.proportion.unknown] = answer;
      return {
        headline,
        caption: "Missing value",
        values,
        text: `? = ${headline}\n${format(values[0])}:${format(values[1])} = ${format(values[2])}:${format(values[3])}`,
      };
    }
    if (state.mode === "shares" && state.percentage.kind === "comparison") {
      const first = readNumber(state.percentage.first);
      const second = readNumber(state.percentage.second);
      if (second === 0) throw new Error("The comparison base must be greater than zero.");
      const headline = `${format((first / second) * 100)}%`;
      return {
        headline,
        caption: `${format(first)} as a percentage of ${format(second)}`,
        values: [first, second],
        text: `${format(first)} is ${headline} of ${format(second)}.`,
      };
    }
    const values = readRatio(state.parts.map((part) => part.value).join(":"));
    const ratio = simplify(values);
    const total = values.reduce((a, b) => a + b, 0);
    const shares = values.map((value) => (value / total) * 100);
    if (state.mode === "split") {
      const amount = readNumber(state.total);
      const amounts = values.map((value) => amount * (value / total));
      return {
        headline: format(amount),
        caption: "Total to distribute",
        values: amounts,
        shares,
        text: `Ratio: ${ratio}\nTotal: ${format(amount)}\n${amounts.map((value, i) => `${state.parts[i].name}: ${format(value)}`).join("\n")}`,
      };
    }
    return {
      headline: ratio,
      caption: state.mode === "shares" ? "Shares of the whole" : "Simplest whole-number ratio",
      values,
      shares,
      text: `Ratio: ${ratio}\n${shares.map((value, i) => `${state.parts[i].name}: ${format(value)}%`).join("\n")}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Check the entered values.";
    return { text: message, error: message };
  }
}

export function resizeRatioDimension(
  state: RatioWorkspace["dimensions"],
  key: "width" | "height",
  value: string,
): RatioWorkspace["dimensions"] {
  const reference = state.reference ?? { width: state.width, height: state.height };
  const next = { ...state, [key]: value, reference: state.locked ? reference : undefined };
  if (!state.locked || !value) return next;
  const previous = Number(reference[key]);
  const other = key === "width" ? "height" : "width";
  if (!(previous > 0) || !(Number(value) > 0) || !(Number(reference[other]) > 0)) return next;
  const scaled = Number(reference[other]) * (Number(value) / previous);
  if (!Number.isFinite(scaled) || scaled > Number.MAX_SAFE_INTEGER / 1_000_000) return next;
  return { ...next, [other]: String(Number(scaled.toFixed(6))) };
}
