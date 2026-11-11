import { useState } from "react";
import type { SpelledChar, SpelledCharKind } from "@typa/engine";
import { registerOutputView } from "../registry";
import { PresentEmpty } from "./empty";
import { SizeToolbar } from "./size-toolbar";

const KIND_COLORS: Record<SpelledCharKind, string> = {
  upper: "#3b82f6",
  lower: "#22c55e",
  digit: "#f59e0b",
  symbol: "#ec4899",
  space: "#8a8a8a",
};

const LEGEND: { kind: SpelledCharKind; label: string }[] = [
  { kind: "upper", label: "Uppercase" },
  { kind: "lower", label: "Lowercase" },
  { kind: "digit", label: "Digit" },
  { kind: "symbol", label: "Symbol" },
  { kind: "space", label: "Space" },
];

function CharCard({ item, position }: { item: SpelledChar; position: number }) {
  const color = KIND_COLORS[item.kind];
  return (
    <div
      className="flex flex-col items-center gap-[0.25em] rounded-[0.75em] px-[0.5em] pt-[0.5em] pb-[0.625em] min-w-[5.25em]"
      style={{ border: `0.125em solid ${color}`, background: `color-mix(in srgb, ${color} 10%, transparent)` }}
    >
      <span className="self-start text-[0.625em] font-mono opacity-50">{position}</span>
      <span className="font-mono text-[3.5em] leading-none font-semibold" style={{ color }}>
        {item.kind === "space" ? "␣" : item.char}
      </span>
      <span className="text-[0.6875em] font-medium text-center opacity-80">{item.label}</span>
    </div>
  );
}

/** Pairs each line with the position of its first character, so numbering runs across lines. */
function withStartPositions(lines: SpelledChar[][]) {
  let next = 1;
  return lines.map((chars) => {
    const start = next;
    next += chars.length;
    return { chars, start };
  });
}

function SpellOutView({ data }: { data: SpelledChar[][]; theme: "dark" | "light" }) {
  const [scalePercent, setScalePercent] = useState(100);
  const hasChars = data.some((line) => line.length > 0);
  if (!hasChars) return <PresentEmpty message="Enter text to spell it out" />;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg text-text">
      <SizeToolbar
        value={scalePercent}
        min={50}
        max={200}
        unit="%"
        accessibleLabel="NATO card size"
        onChange={setScalePercent}
        action={{
          label: "Reset",
          title: "Reset card size to 100%",
          onClick: () => setScalePercent(100),
        }}
      />
      <div className="flex shrink-0 flex-wrap justify-center gap-x-4 gap-y-2 border-b border-border-subtle px-3 py-2 text-[11px] text-text-muted">
        {LEGEND.map(({ kind, label }) => (
          <span key={kind} className="flex items-center gap-1.5">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: KIND_COLORS[kind] }} />
            {label}
          </span>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <div className="flex flex-col gap-[1.75em]" style={{ fontSize: 16 * scalePercent / 100 }}>
          {withStartPositions(data).map(({ chars, start }, lineIndex) => (
            <section key={lineIndex} aria-label={`Input line ${lineIndex + 1}`} className="flex flex-col gap-3">
              <div className="text-center text-[11px] font-medium text-text-muted">
                Line {lineIndex + 1}
              </div>
              {chars.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-[0.75em]">
                  {chars.map((item, index) => (
                    <CharCard key={index} item={item} position={start + index} />
                  ))}
                </div>
              ) : (
                <div className="text-center text-[11px] text-text-faint">Empty line</div>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function SpellOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
      <rect x="1" y="4" width="4" height="8" rx="1" />
      <rect x="6" y="4" width="4" height="8" rx="1" />
      <rect x="11" y="4" width="4" height="8" rx="1" />
    </svg>
  );
}

registerOutputView({
  id: "present-spell-out",
  name: "Spell Out",
  icon: SpellOutIcon,
  parse: (_output, richData) => (Array.isArray(richData) ? (richData as SpelledChar[][]) : []),
  component: SpellOutView,
});
