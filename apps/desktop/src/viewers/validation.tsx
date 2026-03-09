import { registerOutputView } from "./registry";

/* -- Types -- */

interface ValidationResult {
  valid: boolean;
  format: string;
  error?: { message: string; line?: number; column?: number };
  stats?: {
    type: string;
    keys: number;
    items: number;
    depth: number;
    size: number;
    sizeFormatted: string;
  };
}

/* -- Status Icon -- */

function CheckCircle() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="15" stroke="var(--cl-result)" strokeWidth="1.5" opacity="0.25" />
      <circle cx="16" cy="16" r="11" fill="var(--cl-result)" opacity="0.1" />
      <path d="M11 16.5L14.5 20L21 13" stroke="var(--cl-result)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XCircle() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="15" stroke="var(--cl-danger)" strokeWidth="1.5" opacity="0.25" />
      <circle cx="16" cy="16" r="11" fill="var(--cl-danger)" opacity="0.1" />
      <path d="M12.5 12.5L19.5 19.5M19.5 12.5L12.5 19.5" stroke="var(--cl-danger)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* -- Stat Cell -- */

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
      <span className="text-[13px] font-mono text-text">{value}</span>
    </div>
  );
}

/* -- Error Block -- */

function ErrorBlock({ error }: { error: NonNullable<ValidationResult["error"]> }) {
  const hasLocation = error.line != null;

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(248, 81, 73, 0.15)" }}>
      {/* Error header */}
      <div
        className="px-3 py-2 flex items-center gap-2 text-[11px] font-medium"
        style={{ background: "rgba(248, 81, 73, 0.06)", color: "var(--cl-danger)" }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm9-3a1 1 0 00-2 0v4a1 1 0 002 0V5zm-1 7.5a1 1 0 100-2 1 1 0 000 2z" />
        </svg>
        {hasLocation ? `Error at line ${error.line}, column ${error.column}` : "Parse Error"}
      </div>

      {/* Error message */}
      <div className="px-3 py-2.5" style={{ background: "rgba(248, 81, 73, 0.03)" }}>
        <code className="text-[12px] font-mono text-text-secondary leading-relaxed break-all select-text">
          {error.message}
        </code>
      </div>

      {/* Location hint */}
      {hasLocation && (
        <div
          className="px-3 py-1.5 flex items-center gap-1.5 text-[10px] text-text-muted"
          style={{ background: "rgba(248, 81, 73, 0.03)", borderTop: "1px solid rgba(248, 81, 73, 0.08)" }}
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" opacity="0.5">
            <path d="M8 10.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM8 12a4 4 0 100-8 4 4 0 000 8zM8 0a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0V.75A.75.75 0 018 0zm0 13a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 018 13zM3 8a.75.75 0 01-.75.75H.75a.75.75 0 010-1.5h1.5A.75.75 0 013 8zm13 0a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0116 8z" />
          </svg>
          Check your input around line {error.line}
        </div>
      )}
    </div>
  );
}

/* -- Type Badge -- */

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    object: { bg: "rgba(77, 159, 255, 0.1)", text: "var(--cl-accent)" },
    array: { bg: "rgba(168, 85, 247, 0.1)", text: "#a855f7" },
    string: { bg: "rgba(52, 208, 88, 0.1)", text: "var(--cl-result)" },
    number: { bg: "rgba(251, 191, 36, 0.1)", text: "#fbbf24" },
    boolean: { bg: "rgba(244, 114, 182, 0.1)", text: "#f472b6" },
  };
  const c = colors[type] ?? { bg: "rgba(168, 168, 168, 0.1)", text: "var(--text-muted)" };

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium"
      style={{ background: c.bg, color: c.text }}
    >
      {type}
    </span>
  );
}

/* -- Main Component -- */

function ValidationViewer({ data }: { data: ValidationResult; theme: "dark" | "light" }) {
  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-text-faint text-[13px]">
        Enter input to validate
      </div>
    );
  }

  const result = data;

  return (
    <div className="h-full overflow-auto flex items-center justify-center select-none">
      <div className="max-w-lg w-full px-6 py-8 flex flex-col gap-5">

        {/* Status card */}
        <div
          className="rounded-xl px-5 py-4 flex items-center gap-4"
          style={{
            background: result.valid
              ? "rgba(52, 208, 88, 0.04)"
              : "rgba(248, 81, 73, 0.04)",
            border: `1px solid ${result.valid
              ? "rgba(52, 208, 88, 0.12)"
              : "rgba(248, 81, 73, 0.12)"}`,
          }}
        >
          {result.valid ? <CheckCircle /> : <XCircle />}
          <div className="flex flex-col gap-0.5">
            <span
              className="text-[15px] font-semibold"
              style={{ color: result.valid ? "var(--cl-result)" : "var(--cl-danger)" }}
            >
              {result.valid ? "Valid" : "Invalid"} {result.format}
            </span>
            <span className="text-[11px] text-text-muted">
              {result.valid
                ? "Input was parsed successfully"
                : "Input could not be parsed"}
            </span>
          </div>
        </div>

        {/* Stats grid (valid only) */}
        {result.valid && result.stats && (
          <div
            className="rounded-xl px-5 py-4"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--cl-border-subtle)" }}
          >
            <div className="text-[10px] uppercase tracking-wider text-text-faint font-medium mb-3">
              Structure
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] uppercase tracking-wider text-text-muted">Type</span>
                <TypeBadge type={result.stats.type} />
              </div>
              {result.stats.type === "object" && (
                <StatCell label="Keys" value={result.stats.keys} />
              )}
              {result.stats.type === "array" && (
                <StatCell label="Items" value={result.stats.items} />
              )}
              <StatCell label="Depth" value={result.stats.depth} />
              <StatCell label="Size" value={result.stats.sizeFormatted} />
            </div>
          </div>
        )}

        {/* Error details (invalid only) */}
        {!result.valid && result.error && (
          <ErrorBlock error={result.error} />
        )}
      </div>
    </div>
  );
}

/* -- Icon -- */

function ValidationIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12l2 2 4-4" />
      <path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9-9 9-9-1.8-9-9 1.8-9 9-9" />
    </svg>
  );
}

registerOutputView({
  id: "validation",
  name: "Validation",
  parse: (output): ValidationResult => JSON.parse(output),
  icon: ValidationIcon,
  component: ValidationViewer,
});
