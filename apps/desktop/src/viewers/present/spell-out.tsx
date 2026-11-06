import type { SpelledChar, SpelledCharKind } from "@typa/engine";
import { registerOutputView } from "../registry";
import { PresentEmpty } from "./empty";

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
      className="flex flex-col items-center gap-1 rounded-xl px-2 pt-2 pb-2.5 min-w-[84px]"
      style={{ border: `2px solid ${color}`, background: `color-mix(in srgb, ${color} 10%, transparent)` }}
    >
      <span className="self-start text-[10px] font-mono opacity-50">{position}</span>
      <span className="font-mono text-[56px] leading-none font-semibold" style={{ color }}>
        {item.kind === "space" ? "␣" : item.char}
      </span>
      <span className="text-[11px] font-medium text-center opacity-80">{item.label}</span>
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
  const hasChars = data.some((line) => line.length > 0);
  if (!hasChars) return <PresentEmpty message="Enter text to spell it out" />;

  return (
    <div className="h-full overflow-auto p-6 bg-bg text-text">
      <div className="flex flex-col gap-3">
        {withStartPositions(data).map(({ chars, start }, lineIndex) => (
          <div key={lineIndex} className="flex flex-wrap justify-center gap-3 min-h-4">
            {chars.map((item, index) => (
              <CharCard key={index} item={item} position={start + index} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-4 text-[11px] text-text-muted">
        {LEGEND.map(({ kind, label }) => (
          <span key={kind} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: KIND_COLORS[kind] }} />
            {label}
          </span>
        ))}
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
