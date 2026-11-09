import { cn } from "@/lib/utils";

export type CalculatorView = "sheet" | "table" | "image";

const VIEWS: { id: CalculatorView; label: string }[] = [
  { id: "sheet", label: "Sheet" },
  { id: "table", label: "Table" },
  { id: "image", label: "Image" },
];

interface CalculatorViewTabsProps {
  view: CalculatorView;
  onChange: (view: CalculatorView) => void;
  selectionCount: number;
}

export function CalculatorViewTabs({ view, onChange, selectionCount }: CalculatorViewTabsProps) {
  return (
    <div className="flex items-center gap-3 h-[32px] px-3 shrink-0 border-b border-border-subtle/50 bg-bg-surface/60 select-none">
      <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-bg-hover/40">
        {VIEWS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              "h-[22px] px-2.5 rounded-[5px] text-[11px] cursor-pointer transition-colors",
              view === id ? "bg-bg text-text shadow-sm" : "text-text-muted hover:text-text-secondary",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {view !== "sheet" && selectionCount > 0 && (
        <span className="text-[11px] text-text-faint">Showing {selectionCount} selected {selectionCount === 1 ? "line" : "lines"}</span>
      )}
    </div>
  );
}
