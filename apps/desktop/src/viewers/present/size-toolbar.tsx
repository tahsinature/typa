import type { ReactNode } from "react";

interface SizeToolbarProps {
  children?: ReactNode;
  value: number;
  min: number;
  max: number;
  unit: "px" | "%";
  accessibleLabel: string;
  onChange: (value: number) => void;
  action: {
    label: string;
    title: string;
    onClick: () => void;
    active?: boolean;
  };
}

export function SizeToolbar({ children, value, min, max, unit, accessibleLabel, onChange, action }: SizeToolbarProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1.5 border-b border-border-subtle px-3 py-1.5">
      {children}
      <div className="flex min-w-0 items-center gap-3">
        <label className="flex min-w-0 items-center gap-3 text-[11px] text-text-muted">
          Size
          <input
            type="range"
            min={min}
            max={max}
            step={1}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            aria-label={accessibleLabel}
            aria-valuetext={`${value} ${unit === "%" ? "percent" : "pixels"}`}
            className="w-28 min-w-0 accent-accent"
          />
        </label>
        <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-text-muted">
          {value}{unit === "%" ? "%" : " px"}
        </span>
        <button
          type="button"
          title={action.title}
          aria-pressed={action.active}
          onClick={action.onClick}
          className={`h-6 shrink-0 rounded-md px-2 text-[11px] font-medium cursor-pointer focus-visible:outline-2 focus-visible:outline-accent ${
            action.active ? "bg-accent/15 text-accent" : "text-text-muted hover:bg-bg-hover hover:text-text"
          }`}
        >
          {action.label}
        </button>
      </div>
    </div>
  );
}
