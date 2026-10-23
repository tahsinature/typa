import type { RatioWorkspace, RatioWorkspaceResult } from "@typa/engine";
import { useId } from "react";
import { colors, display, ShareBar } from "./controls";

function ShapePreview({ width, height, unit }: { width: number; height: number; unit: string }) {
  const gridId = useId();
  const scale = Math.min(250 / width, 140 / height);
  const w = Math.max(1, width * scale);
  const h = Math.max(1, height * scale);
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-input p-3">
      <svg
        viewBox="0 0 320 210"
        role="img"
        aria-label={`Shape preview, ${display(width)} by ${display(height)} ${unit}`}
        className="mx-auto w-full max-w-80 text-accent"
      >
        <defs>
          <pattern id={gridId} width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M 16 0 L 0 0 0 16" fill="none" stroke="currentColor" strokeOpacity=".08" />
          </pattern>
        </defs>
        <rect width="320" height="210" fill={`url(#${gridId})`} />
        <rect
          x={(320 - w) / 2}
          y={(180 - h) / 2 + 8}
          width={w}
          height={h}
          rx="2"
          fill="currentColor"
          fillOpacity=".12"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <text x="160" y="198" textAnchor="middle" fill="currentColor" fontSize="12" fontFamily="monospace">
          {display(width)} × {display(height)} {unit}
        </text>
      </svg>
      <p className="text-center text-[10px] text-text-faint">Shape preview · fitted to available space</p>
    </div>
  );
}

export function ResultPreview({ state, result }: { state: RatioWorkspace; result: RatioWorkspaceResult }) {
  if (!result.values) return null;
  if (state.mode === "scale")
    return <ShapePreview width={result.values[0]} height={result.values[1]} unit={state.dimensions.unit} />;
  if (state.mode === "proportion")
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg border border-border-subtle p-4 font-mono text-[16px] text-text">
          <span className="break-words">
            {display(result.values[0])} : {display(result.values[1])}
          </span>
          <span className="text-text-faint">=</span>
          <span className="break-words">
            {display(result.values[2])} : {display(result.values[3])}
          </span>
        </div>
        <p className="text-[12px] leading-relaxed text-text-muted">
          Both pairs have the same relationship. Changing any known value updates the missing one.
        </p>
      </div>
    );
  if (state.mode === "shares" && state.percentage.kind === "comparison") {
    const percent = (result.values[0] / result.values[1]) * 100;
    return (
      <div className="flex flex-col gap-3">
        <div className="h-3 overflow-hidden rounded-full bg-bg-input" aria-hidden="true">
          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, percent)}%` }} />
        </div>
        <div className="flex justify-between text-[11px] text-text-muted">
          <span>0%</span>
          <span>100% reference</span>
        </div>
        {percent > 100 && (
          <p className="text-[12px] text-text-muted">This value exceeds the reference by {display(percent - 100)}%.</p>
        )}
      </div>
    );
  }
  if (!result.shares) return null;
  return (
    <>
      <ShareBar parts={state.parts} shares={result.shares} />
      {state.mode === "split" && (
        <>
          <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
            {result.values.map((value, i) => (
              <div key={state.parts[i].id} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="truncate text-text-secondary">{state.parts[i].name || `Part ${i + 1}`}</span>
                <span className="font-mono font-medium" style={{ color: colors[i % colors.length] }}>
                  {display(value)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-text-faint">
            Amounts are rounded for display. Currency rounding and leftover cents are not allocated.
          </p>
        </>
      )}
    </>
  );
}
