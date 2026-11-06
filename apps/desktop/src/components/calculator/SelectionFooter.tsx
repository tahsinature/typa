import type { SelectionSummary } from "@typa/engine";
import { CheckIcon, CopyIcon } from "./icons";
import { useCopy } from "./useCopy";

/** Sum, average and count of the selected lines. */
export function SelectionFooter({ summary }: { summary: SelectionSummary | null }) {
  const { copied, copy } = useCopy();

  return (
    <div className="flex items-center justify-end gap-4 h-[26px] px-4 shrink-0 border-t border-border-subtle/50 text-[11px] tabular-nums text-text-muted select-none">
      {summary?.sum ? (
        <>
          <Stat label="Sum" value={summary.sum} />
          {summary.average && <Stat label="Avg" value={summary.average} />}
          <Stat label="Count" value={String(summary.count)} />
          <button
            type="button"
            onClick={() => copy(summary.sum ?? "")}
            className="flex items-center gap-1 hover:text-text-secondary transition-colors cursor-pointer"
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
            <span>{copied ? "Copied" : "Copy sum"}</span>
          </button>
        </>
      ) : (
        <span className="text-text-faint">Select lines to see their sum</span>
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
