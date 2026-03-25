import { useState, useMemo } from "react";
import { registerOutputView } from "./registry";

/* ── Types ── */

interface DuplicateGroup {
  original: string;
  normalized: string;
  lines: { num: number; text: string }[];
}

/* ── Core Logic ── */

function findDuplicates(
  input: string,
  ignoreChars: string,
  caseSensitive: boolean,
): DuplicateGroup[] {
  const lines = input.split("\n");
  const groups = new Map<string, DuplicateGroup>();

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) continue;

    let normalized = trimmed;

    // Strip ignored characters
    if (ignoreChars) {
      for (const ch of ignoreChars) {
        normalized = normalized.replaceAll(ch, "");
      }
      normalized = normalized.trim();
    }

    if (!caseSensitive) {
      normalized = normalized.toLowerCase();
    }

    const existing = groups.get(normalized);
    if (existing) {
      existing.lines.push({ num: i + 1, text: raw });
    } else {
      groups.set(normalized, {
        original: trimmed,
        normalized,
        lines: [{ num: i + 1, text: raw }],
      });
    }
  }

  return [...groups.values()]
    .filter((g) => g.lines.length > 1)
    .sort((a, b) => b.lines.length - a.lines.length);
}

/* ── Icons ── */

function DuplicateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="13" height="13" rx="2" />
      <path d="M16 16v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2" />
    </svg>
  );
}

/* ── Components ── */

function OptionToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-7 h-4 rounded-full transition-colors duration-150 ${
          checked ? "bg-accent" : "bg-border-subtle"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-3 rounded-full bg-white transition-transform duration-150 ${
            checked ? "translate-x-3" : "translate-x-0"
          }`}
        />
      </button>
      <span className="text-[11px] text-text-secondary">{label}</span>
    </label>
  );
}

function DuplicateCard({ group }: { group: DuplicateGroup }) {
  const color = "#fb923c";

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        borderColor: `color-mix(in srgb, ${color} 15%, transparent)`,
        background: `color-mix(in srgb, ${color} 3%, transparent)`,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-3.5 py-2.5">
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums shrink-0"
          style={{
            background: `color-mix(in srgb, ${color} 10%, transparent)`,
            color,
          }}
        >
          {group.lines.length}x
        </span>
        <span className="text-[12.5px] font-mono text-text truncate" title={group.original}>
          {group.original}
        </span>
      </div>

      {/* Line details */}
      <div className="px-3.5 pb-2.5">
        <div className="flex flex-wrap gap-1.5">
          {group.lines.map((line) => (
            <span
              key={line.num}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-bg-secondary/50 text-text-secondary"
              title={line.text}
            >
              <span className="text-text-faint">L</span>
              {line.num}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Main Viewer ── */

function DuplicateViewer({ data }: { data: string; theme: "dark" | "light" }) {
  const [ignoreChars, setIgnoreChars] = useState(",;");
  const [caseSensitive, setCaseSensitive] = useState(true);

  const duplicates = useMemo(
    () => findDuplicates(data, ignoreChars, caseSensitive),
    [data, ignoreChars, caseSensitive],
  );

  const totalDuplicateLines = duplicates.reduce((sum, g) => sum + g.lines.length, 0);

  if (!data.trim()) {
    return (
      <div className="h-full flex items-center justify-center text-text-faint text-[13px] select-none">
        Enter text to find duplicates
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border-subtle/50 bg-bg-secondary/20 shrink-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-text-faint uppercase tracking-wider font-medium">
            Ignore
          </span>
          <input
            type="text"
            value={ignoreChars}
            onChange={(e) => setIgnoreChars(e.target.value)}
            placeholder="e.g. ,;"
            className="w-20 h-[26px] rounded-md px-2 text-[12px] font-mono bg-bg-input text-text border border-border-subtle outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/40 placeholder:text-text-faint"
          />
        </div>

        <OptionToggle
          label="Case sensitive"
          checked={caseSensitive}
          onChange={setCaseSensitive}
        />

        <div className="ml-auto flex items-center gap-3 shrink-0">
          {duplicates.length > 0 ? (
            <>
              <span className="text-[11px] text-text-secondary">
                <strong className="text-[#fb923c] font-semibold">{duplicates.length}</strong>{" "}
                group{duplicates.length !== 1 ? "s" : ""}
              </span>
              <span className="text-[10.5px] text-text-faint">
                {totalDuplicateLines} lines
              </span>
            </>
          ) : (
            <span className="text-[11px] text-[#34d058]">No duplicates</span>
          )}
        </div>
      </div>

      {/* Results */}
      {duplicates.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 select-none">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[rgba(52,208,88,0.06)] border border-[rgba(52,208,88,0.12)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d058" strokeWidth="2" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-[12px] text-text-faint/60">All lines are unique</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto p-3 space-y-2">
          {duplicates.map((group, idx) => (
            <DuplicateCard key={idx} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Register ── */

registerOutputView({
  id: "duplicate-viewer",
  name: "Duplicates",
  icon: DuplicateIcon,
  parse: (output: string) => output,
  component: DuplicateViewer,
});
