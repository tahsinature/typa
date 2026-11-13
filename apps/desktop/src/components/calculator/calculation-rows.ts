import type { LineResult } from "@typa/engine";

export type CalculationRow =
  | { kind: "heading"; line: number; text: string }
  | { kind: "note"; line: number; text: string }
  | { kind: "value"; line: number; item: string; calculation: string; result: string | null; error: string | null };

/** Sheet lines as table rows. Blank lines are skipped; with a selection, only selected lines are kept. */
export function buildRows(results: LineResult[], selectedLines: number[]): CalculationRow[] {
  const selected = new Set(selectedLines);
  const rows: CalculationRow[] = [];

  for (const { line, input, result, error, item, calculation } of results) {
    if (selected.size > 0 && !selected.has(line)) continue;
    const text = input.trim();
    if (!text) continue;

    if (text.startsWith("#")) rows.push({ kind: "heading", line, text: text.replace(/^#+\s*/, "") });
    else if (text.startsWith("//")) rows.push({ kind: "note", line, text: text.replace(/^\/\/\s*/, "") });
    else {
      const expression = text.replace(/\s\/\/.*$/, "");
      rows.push({ kind: "value", line, item: item ?? "", calculation: calculation ?? expression, result, error });
    }
  }
  return rows;
}
