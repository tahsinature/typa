import { useState, type ReactNode } from "react";
import type { RatioPart, RatioWorkspaceResult } from "@typa/engine";

export const controlClass =
  "w-full min-w-0 rounded-lg border border-border-subtle bg-bg-input px-3 py-2 text-[14px] text-text font-mono outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50";
export const buttonClass =
  "rounded-md border border-border-subtle px-3 py-1.5 text-[12px] text-text-secondary hover:bg-bg-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
export const colors = ["var(--cl-accent)", "#a6a34e", "#c98967", "#8d87c5", "#5ca89b", "#cb7d9d"];
export const display = (value: number) =>
  Number(value.toPrecision(10)).toLocaleString("en-US", { maximumFractionDigits: 6 });

export function NumberField({
  label,
  value,
  onChange,
  suffix,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  disabled?: boolean;
}) {
  const invalid = !disabled && value !== "" && !/^\d+(?:\.\d{1,6})?$/.test(value);
  return (
    <label className="flex min-w-0 flex-col gap-2 text-[12px] text-text-muted">
      {label}
      <span className="relative">
        <input
          className={`${controlClass} ${suffix ? "pr-12" : ""}`}
          type={disabled ? "text" : "number"}
          min="0"
          step="any"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          disabled={disabled}
          aria-invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px]">{suffix}</span>
        )}
      </span>
    </label>
  );
}

export function EditorSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-5">
      <div>
        <h2 className="text-[17px] font-semibold tracking-tight text-text">{title}</h2>
        <p className="mt-1.5 text-[12px] leading-relaxed text-text-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function PartsEditor({ parts, onChange }: { parts: RatioPart[]; onChange: (parts: RatioPart[]) => void }) {
  const update = (index: number, patch: Partial<RatioPart>) =>
    onChange(parts.map((part, i) => (i === index ? { ...part, ...patch } : part)));
  return (
    <div className="flex flex-col gap-3">
      {parts.map((part, index) => (
        <div key={part.id} className="flex items-end gap-2">
          <span
            aria-hidden="true"
            className="mb-3.5 size-2 shrink-0 rounded-full"
            style={{ background: colors[index % colors.length] }}
          />
          <label className="flex min-w-0 flex-1 flex-col gap-2 text-[12px] text-text-muted">
            Part {index + 1} name
            <input
              className={`${controlClass} font-sans text-[12px]`}
              value={part.name}
              onChange={(event) => update(index, { name: event.target.value })}
            />
          </label>
          <div className="w-24 shrink-0">
            <NumberField
              label={`Part ${index + 1} weight`}
              value={part.value}
              onChange={(value) => update(index, { value })}
            />
          </div>
          <button
            type="button"
            className={`${buttonClass} mb-0.5 px-2`}
            disabled={parts.length <= 2}
            aria-label={`Remove part ${index + 1}`}
            onClick={() => onChange(parts.filter((_, i) => i !== index))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className={`${buttonClass} self-start`}
        disabled={parts.length >= 12}
        onClick={() => onChange([...parts, { id: crypto.randomUUID(), name: `Part ${parts.length + 1}`, value: "1" }])}
      >
        + Add part
      </button>
    </div>
  );
}

export function ShareBar({ parts, shares }: { parts: RatioPart[]; shares: number[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-9 overflow-hidden rounded-lg bg-bg-input" aria-hidden="true">
        {shares.map((share, i) => (
          <div
            key={parts[i].id}
            className="flex min-w-0 items-center justify-center overflow-hidden text-[11px] font-mono motion-safe:transition-[width] motion-safe:duration-200"
            style={{
              width: `${share}%`,
              background: colors[i % colors.length],
              color: i % colors.length === 0 ? "var(--bg)" : "#17202e",
            }}
          >
            {share >= 12 ? `${display(share)}%` : ""}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        {shares.map((share, i) => (
          <div key={parts[i].id} className="flex items-center gap-2 text-[12px]">
            <span className="size-2 shrink-0 rounded-full" style={{ background: colors[i % colors.length] }} />
            <span className="min-w-0 flex-1 truncate text-text-secondary">{parts[i].name || `Part ${i + 1}`}</span>
            <span className="font-mono tabular-nums text-text">{display(share)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ResultPanel({ result, children }: { result: RatioWorkspaceResult; children?: ReactNode }) {
  const [copyState, setCopyState] = useState("Copy result");
  async function copy() {
    try {
      await navigator.clipboard.writeText(result.text);
      setCopyState("Copied");
    } catch {
      setCopyState("Copy failed");
    }
  }
  return (
    <aside className="flex min-w-0 flex-col gap-6 rounded-xl border border-border-subtle bg-bg-surface p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-text-muted">Live result</span>
        <button
          type="button"
          className={buttonClass}
          disabled={!!result.error}
          onClick={copy}
          onBlur={() => setCopyState("Copy result")}
        >
          {copyState}
        </button>
      </div>
      {result.error ? (
        <p role="status" className="text-[13px] leading-relaxed text-text-muted">
          {result.error}
        </p>
      ) : (
        <>
          <div aria-live="polite" aria-atomic="true">
            <div className="break-words font-mono text-[36px] font-medium leading-tight tracking-tight text-accent sm:text-[44px]">
              {result.headline}
            </div>
            <div className="mt-2 text-[12px] text-text-muted">{result.caption}</div>
          </div>
          {children}
        </>
      )}
    </aside>
  );
}
