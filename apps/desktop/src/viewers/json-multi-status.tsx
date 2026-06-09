import type { NodeStatusOption } from "@typa/engine";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";

/** Sentinel filter value meaning "nodes with no status". */
export const STATUS_FILTER_UNMARKED = "__unmarked__";

const triggerClass =
  "flex items-center gap-1.5 h-[22px] px-2 rounded-md text-[11px] font-medium text-text-muted hover:text-text-secondary hover:bg-bg-hover/80 transition-colors cursor-pointer outline-none";

/* -- Icons -- */

function ChevronDownIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-faint shrink-0">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function JumpDownIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  );
}

function Dot({ color }: { color?: string }) {
  return <span className="size-[6px] rounded-full shrink-0" style={{ background: color ?? "var(--text-faint)" }} />;
}

export function statusOption(options: NodeStatusOption[], value: string | undefined) {
  return value ? options.find((o) => o.value === value) : undefined;
}

/* -- Per-node status picker (rendered in each card header) -- */

export function StatusPicker({
  status,
  options,
  onSelect,
}: {
  status?: string;
  options: NodeStatusOption[];
  onSelect: (value: string | null) => void;
}) {
  // A single declared option behaves like a checkbox toggle, not a menu.
  if (options.length === 1) {
    const only = options[0];
    const on = status === only.value;
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={(e) => { e.stopPropagation(); onSelect(on ? null : only.value); }}
        className={triggerClass}
      >
        <span
          className="size-[12px] rounded-[3px] border flex items-center justify-center shrink-0"
          style={{
            borderColor: on ? (only.color ?? "var(--cl-result)") : "var(--cl-border-subtle)",
            background: on ? (only.color ?? "var(--cl-result)") : "transparent",
          }}
        >
          {on && (
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </span>
        {only.label ?? only.value}
      </button>
    );
  }

  const current = statusOption(options, status);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" onClick={(e) => e.stopPropagation()} className={triggerClass}>
          <Dot color={current?.color} />
          {current ? (current.label ?? current.value) : "Set status"}
          <ChevronDownIcon />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((o) => (
          <DropdownMenuItem key={o.value} onClick={() => onSelect(o.value)} className={o.value === status ? "text-accent" : ""}>
            <Dot color={o.color} />
            <span className="ml-2">{o.label ?? o.value}</span>
          </DropdownMenuItem>
        ))}
        {status && (
          <DropdownMenuItem onClick={() => onSelect(null)} className="text-text-muted">
            <span className="ml-[14px]">Clear</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* -- Summary-bar controls: counts, filter, jump-to-next -- */

export function StatusSummary({
  counts,
  left,
  options,
  filter,
  onFilter,
  onJumpNext,
  jumpDisabled,
}: {
  counts: Record<string, number>;
  left: number;
  options: NodeStatusOption[];
  filter: string | null;
  onFilter: (value: string | null) => void;
  onJumpNext: () => void;
  jumpDisabled: boolean;
}) {
  const filterLabel =
    filter === null
      ? "All"
      : filter === STATUS_FILTER_UNMARKED
        ? "Unmarked"
        : (statusOption(options, filter)?.label ?? filter);

  return (
    <div className="flex items-center gap-3 shrink-0">
      <div className="flex items-center gap-2 text-[11px] text-text-muted">
        {options.map((o) => {
          const c = counts[o.value] ?? 0;
          if (!c) return null;
          return (
            <span key={o.value} className="inline-flex items-center gap-1 tabular-nums" title={o.label ?? o.value}>
              <Dot color={o.color} />
              {c}
            </span>
          );
        })}
        {left > 0 && <span className="text-text-faint tabular-nums">{left} left</span>}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={triggerClass}>
            <span className="text-text-faint">Show:</span>
            {filterLabel}
            <ChevronDownIcon />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onFilter(null)} className={filter === null ? "text-accent" : ""}>All</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onFilter(STATUS_FILTER_UNMARKED)} className={filter === STATUS_FILTER_UNMARKED ? "text-accent" : ""}>Unmarked</DropdownMenuItem>
          {options.map((o) => (
            <DropdownMenuItem key={o.value} onClick={() => onFilter(o.value)} className={filter === o.value ? "text-accent" : ""}>
              <Dot color={o.color} />
              <span className="ml-2">{o.label ?? o.value}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <IconButton tooltip="Jump to next unmarked" variant="subtle" disabled={jumpDisabled} onClick={onJumpNext}>
        <JumpDownIcon />
      </IconButton>
    </div>
  );
}
