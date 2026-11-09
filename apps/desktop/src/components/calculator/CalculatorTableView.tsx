import type { SelectionSummary } from "@typa/engine";
import { cardColors } from "@/components/image-frame/frame-themes";
import type { CalculationRow } from "./calculation-rows";
import { CalculationTable } from "./CalculationTable";
import { EmptyCalculation } from "./EmptyCalculation";

interface CalculatorTableViewProps {
  rows: CalculationRow[];
  summary: SelectionSummary;
  theme: "dark" | "light";
}

export function CalculatorTableView({ rows, summary, theme }: CalculatorTableViewProps) {
  if (rows.length === 0) return <EmptyCalculation />;
  const colors = { ...cardColors(theme === "dark"), background: "transparent" };

  return (
    <div className="h-full overflow-auto px-6 py-5">
      <div className="max-w-[760px] mx-auto">
        <CalculationTable rows={rows} summary={summary} colors={colors} />
      </div>
    </div>
  );
}
