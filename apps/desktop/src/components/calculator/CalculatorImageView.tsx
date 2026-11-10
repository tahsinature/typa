import type { SelectionSummary } from "@typa/engine";
import { ImageFrame } from "@/components/image-frame/ImageFrame";
import type { CalculationRow } from "./calculation-rows";
import { CalculationTable } from "./CalculationTable";
import { EmptyCalculation } from "./EmptyCalculation";

const MAX_IMAGE_ROWS = 50;

interface CalculatorImageViewProps {
  rows: CalculationRow[];
  summary: SelectionSummary;
  theme: "dark" | "light";
}

export function CalculatorImageView({ rows, summary, theme }: CalculatorImageViewProps) {
  if (rows.length === 0) return <EmptyCalculation />;
  if (rows.length > MAX_IMAGE_ROWS) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 px-6 text-center" role="status">
        <p className="text-[13px] font-medium text-text">Too many rows for an image preview</p>
        <p className="text-[12px] text-text-muted">
          Image previews support up to {MAX_IMAGE_ROWS} rows. Select {MAX_IMAGE_ROWS} or fewer rows in Sheet view, then return to Image.
        </p>
        <p className="text-[11px] text-text-faint">{rows.length.toLocaleString()} rows in the current preview</p>
      </div>
    );
  }

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
