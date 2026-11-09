import type { SelectionSummary } from "@typa/engine";
import { CheckIcon, CopyIcon } from "./icons";
import { useCopy } from "./useCopy";

/** Whole-sheet total by default; selection totals while text is selected. */
export function SelectionFooter({ summary, selected }: { summary: SelectionSummary; selected: boolean }) {
  const { copied, copy } = useCopy();

  return (
    <div title={selected ? "Clear the selection to see the whole-sheet total" : "Select lines to see their subtotal"} className="flex items-center justify-end gap-4 h-[26px] px-4 shrink-0 border-t border-border-subtle/50 text-[11px] tabular-nums text-text-muted select-none">
      {!selected && summary.sum && <span className="mr-auto text-text-faint">Select lines for subtotal</span>}
      {summary.sum ? (
        <>
          <Stat label={selected ? "Selected total" : "Total"} value={summary.sum} />
          {selected && summary.average && <Stat label="Avg" value={summary.average} />}
          <Stat label="Count" value={String(summary.count)} />
          <button
            type="button"
            onClick={() => copy(summary.sum ?? "")}
            className="flex items-center gap-1 hover:text-text-secondary transition-colors cursor-pointer"
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
            <span>{copied ? "Copied" : "Copy total"}</span>
          </button>
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
