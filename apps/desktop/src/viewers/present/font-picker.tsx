const FONT_PRESETS = [
  { label: "System", family: "inherit" },
  { label: "Sans Serif", family: "Arial, Helvetica, sans-serif" },
  { label: "Serif", family: "Georgia, 'Times New Roman', serif" },
  { label: "Monospace", family: "'SF Mono', Menlo, Consolas, monospace" },
];

export function FontPicker({ value, onChange }: { value: string; onChange: (family: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-[11px] text-text-muted">
      Font
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Big Text font"
        className="h-6 rounded-md border border-border-subtle bg-bg-input px-2 text-[11px] text-text-secondary cursor-pointer focus-visible:outline-2 focus-visible:outline-accent"
      >
        {FONT_PRESETS.map(({ label, family }) => (
          <option key={family} value={family}>{label}</option>
        ))}
      </select>
    </label>
  );
}
