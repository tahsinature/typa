import { useMemo } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { formatCell } from "@/components/data-table/table-data";
import type { CalculationRow } from "./calculation-rows";
import { EmptyCalculation } from "./EmptyCalculation";

const RIGHT_ALIGNED_COLUMNS = ["Result"];

function renderCalculationCell(column: string, value: unknown, row: Record<string, unknown>) {
  const text = formatCell(value);
  if (column === "Result") {
    return (
      <span className={row.error ? "text-danger whitespace-nowrap tabular-nums" : "text-result whitespace-nowrap tabular-nums"} title={typeof row.error === "string" ? row.error : undefined}>
        {text}
      </span>
    );
  }
  if (row.kind === "heading") return <strong>{text}</strong>;
  if (row.kind === "note") return <span className="text-text-muted italic">{text}</span>;
  return <span className="whitespace-pre-wrap break-words">{text}</span>;
}

export function CalculatorTableView({ rows }: { rows: CalculationRow[] }) {
  const data = useMemo(() => ({
    columns: ["Item", "Calculation", "Result"],
    rows: rows.map((row) => ({
      Item: row.kind === "value" ? row.item : row.text,
      Calculation: row.kind === "value" ? row.calculation : "",
      Result: row.kind === "value" ? row.result ?? (row.error ? "Error" : "") : "",
      kind: row.kind,
      error: row.kind === "value" ? row.error : null,
    })),
  }), [rows]);

  if (rows.length === 0) return <EmptyCalculation />;
  return <DataTable data={data} renderCell={renderCalculationCell} rightAlignedColumns={RIGHT_ALIGNED_COLUMNS} />;
}
