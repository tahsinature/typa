import type { SelectionSummary } from "@typa/engine";
import type { CardColors } from "@/components/image-frame/frame-themes";
import type { CalculationRow } from "./calculation-rows";

const FONT_FAMILY = "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace";

interface CalculationTableProps {
  rows: CalculationRow[];
  summary: SelectionSummary;
  colors: CardColors;
}

/**
 * Item | Calculation | Result table with a totals row.
 * Uses inline styles only, so it renders the same when captured as an image.
 */
export function CalculationTable({ rows, summary, colors }: CalculationTableProps) {
  const cell = { padding: "6px 16px", borderTop: `1px solid ${colors.divider}` };

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FONT_FAMILY, fontSize: 13, lineHeight: 1.6, color: colors.text }}>
      <thead>
        <tr style={{ color: colors.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          <th style={{ padding: "4px 16px 8px", textAlign: "left", fontWeight: 600 }}>Item</th>
          <th style={{ padding: "4px 16px 8px", textAlign: "left", fontWeight: 600 }}>Calculation</th>
          <th style={{ padding: "4px 16px 8px", textAlign: "right", fontWeight: 600 }}>Result</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.line}>
            {row.kind === "heading" && (
              <td colSpan={3} style={{ ...cell, paddingTop: 12, fontWeight: 600 }}>{row.text}</td>
            )}
            {row.kind === "note" && (
              <td colSpan={3} style={{ ...cell, color: colors.muted, fontStyle: "italic" }}>{row.text}</td>
            )}
            {row.kind === "value" && (
              <>
                <td style={{ ...cell, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{row.item}</td>
                <td style={{ ...cell, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{row.calculation}</td>
                <td style={{ ...cell, textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", color: row.error ? colors.danger : colors.accent }}>
                  {row.result ?? (row.error ? "Error" : "")}
                </td>
              </>
            )}
          </tr>
        ))}
      </tbody>
      {summary.sum && (
        <tfoot>
          <tr style={{ fontWeight: 600 }}>
            <td colSpan={2} style={{ ...cell, borderTop: `2px solid ${colors.divider}` }}>
              Total
              <span style={{ marginLeft: 12, fontWeight: 400, fontSize: 11, color: colors.muted }}>
                {summary.average && `Avg ${summary.average} · `}Count {summary.count}
              </span>
            </td>
            <td style={{ ...cell, borderTop: `2px solid ${colors.divider}`, textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
              {summary.sum}
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}
