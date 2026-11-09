import type { SelectionSummary } from "@typa/engine";
import { ImageFrame } from "@/components/image-frame/ImageFrame";
import type { CalculationRow } from "./calculation-rows";
import { CalculationTable } from "./CalculationTable";
import { EmptyCalculation } from "./EmptyCalculation";

interface CalculatorImageViewProps {
  rows: CalculationRow[];
  summary: SelectionSummary;
  theme: "dark" | "light";
}

export function CalculatorImageView({ rows, summary, theme }: CalculatorImageViewProps) {
  if (rows.length === 0) return <EmptyCalculation />;

  return (
    <ImageFrame baseName="Calculation" theme={theme} contentKey={JSON.stringify([rows, summary])} defaultWidth={560}>
      {({ colors }) => (
        <div style={{ padding: "0 4px 12px" }}>
          <CalculationTable rows={rows} summary={summary} colors={colors} />
        </div>
      )}
    </ImageFrame>
  );
}
