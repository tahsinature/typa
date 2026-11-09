import type { SelectionSummary } from "@typa/engine";
import { useCopy } from "./useCopy";

/** Whole-sheet total by default; selection totals while text is selected. */
export function SelectionFooter({ summary, selected }: { summary: SelectionSummary; selected: boolean }) {
  const { copied, copy } = useCopy();

  return (
    <div title={selected ? "Clear the selection to see the whole-sheet total" : "Select lines to see their subtotal"} className="flex items-center justify-end gap-4 h-[26px] px-4 shrink-0 border-t border-border-subtle/50 text-[11px] tabular-nums text-text-muted select-none">
      {!selected && summary.sum && <span className="mr-auto text-text-faint">Select lines for subtotal</span>}
      {summary.sum ? (
        <>
          <button
            type="button"
            title="Click to copy"
            onClick={() => copy(summary.sum ?? "")}
            className="group cursor-pointer"
          >
            <span className="text-text-faint">{selected ? "Selected total" : "Total"}</span>{" "}
            <span className="text-text-secondary group-hover:text-text transition-colors">{copied ? "Copied" : summary.sum}</span>
          </button>
          {summary.average && <Stat label="Avg" value={summary.average} />}
          <Stat label="Count" value={String(summary.count)} />
        </>
      ) : (
        <span className="text-text-faint">{selected ? "No values in selection" : "No values to total"}</span>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="text-text-faint">{label}</span> <span className="text-text-secondary">{value}</span>
    </span>
  );
}
