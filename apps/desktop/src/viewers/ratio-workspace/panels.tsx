import type { RatioWorkspace } from "@typa/engine";
import { resizeRatioDimension } from "@typa/engine";
import { buttonClass, controlClass, EditorSection, NumberField, PartsEditor } from "./controls";

interface PanelProps {
  state: RatioWorkspace;
  onChange: (state: RatioWorkspace) => void;
}

export function RatioPanel({ state, onChange }: PanelProps) {
  return (
    <EditorSection
      title="Find the simplest ratio"
      description="Compare any number of quantities: dimensions, ingredients, mixes, or shares. All values should use the same unit."
    >
      <PartsEditor parts={state.parts} onChange={(parts) => onChange({ ...state, parts })} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClass}
          onClick={() => onChange({ ...state, parts: [...state.parts].reverse() })}
        >
          Reverse order ⇄
        </button>
        {state.parts.length === 2 && (
          <button
            type="button"
            className={buttonClass}
            disabled={state.parts.some((part) => !(Number(part.value) > 0))}
            onClick={() =>
              onChange({
                ...state,
                mode: "scale",
                dimensions: {
                  ...state.dimensions,
                  width: state.parts[0].value,
                  height: state.parts[1].value,
                  reference: undefined,
                },
              })
            }
          >
            Use for dimensions →
          </button>
        )}
      </div>
    </EditorSection>
  );
}

export function DimensionsPanel({ state, onChange }: PanelProps) {
  const { dimensions } = state;
  return (
    <EditorSection
      title="Resize without changing the shape"
      description="Lock the ratio and edit either dimension. The other follows automatically. Unlock to define a new shape."
    >
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Width"
          value={dimensions.width}
          suffix={dimensions.unit}
          onChange={(value) => onChange({ ...state, dimensions: resizeRatioDimension(dimensions, "width", value) })}
        />
        <NumberField
          label="Height"
          value={dimensions.height}
          suffix={dimensions.unit}
          onChange={(value) => onChange({ ...state, dimensions: resizeRatioDimension(dimensions, "height", value) })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={`${buttonClass} ${dimensions.locked ? "border-accent/40 text-accent bg-accent/10" : ""}`}
          aria-pressed={dimensions.locked}
          onClick={() =>
            onChange({ ...state, dimensions: { ...dimensions, locked: !dimensions.locked, reference: undefined } })
          }
        >
          {dimensions.locked ? "Ratio locked" : "Ratio unlocked"}
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={() =>
            onChange({
              ...state,
              dimensions: { ...dimensions, width: dimensions.height, height: dimensions.width, reference: undefined },
            })
          }
        >
          Swap ⇄
        </button>
        <label className="ml-auto flex items-center gap-2 text-[12px] text-text-muted">
          Unit
          <select
            aria-label="Unit"
            className={`${controlClass} w-20 text-[12px]`}
            value={dimensions.unit}
            onChange={(event) => onChange({ ...state, dimensions: { ...dimensions, unit: event.target.value } })}
          >
            {["mm", "cm", "in", "px"].map((unit) => (
              <option key={unit}>{unit}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-[11px] leading-relaxed text-text-faint">
        Unit selection labels both dimensions; it does not convert them. Physical size and pixel resolution require a
        separate DPI value.
      </p>
    </EditorSection>
  );
}

export function ProportionPanel({ state, onChange }: PanelProps) {
  const { proportion } = state;
  const labels = ["Original quantity", "Original reference", "New quantity", "New reference"];
  return (
    <EditorSection
      title="Find the missing value"
      description="If A relates to B, what relates to D? Choose which value to solve, then fill in the other three."
    >
      <label className="flex flex-col gap-2 text-[12px] text-text-muted">
        Solve for
        <select
          aria-label="Solve for"
          className={`${controlClass} font-sans text-[12px]`}
          value={proportion.unknown}
          onChange={(event) =>
            onChange({ ...state, proportion: { ...proportion, unknown: Number(event.target.value) } })
          }
        >
          {labels.map((label, i) => (
            <option key={label} value={i}>
              {String.fromCharCode(65 + i)} · {label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-4">
        {labels.map((label, i) => (
          <NumberField
            key={label}
            label={`${String.fromCharCode(65 + i)} · ${label}`}
            disabled={i === proportion.unknown}
            value={i === proportion.unknown ? "?" : proportion.values[i]}
            onChange={(value) =>
              onChange({
                ...state,
                proportion: {
                  ...proportion,
                  values: proportion.values.map((old, index) => (index === i ? value : old)),
                },
              })
            }
          />
        ))}
      </div>
      <p className="font-mono text-center text-[13px] text-text-muted">A : B = C : D</p>
    </EditorSection>
  );
}

export function SplitPanel({ state, onChange }: PanelProps) {
  return (
    <EditorSection
      title="Give every part its share"
      description="Divide a budget, a batch, or any total using relative weights. Name the parts to keep the result easy to read."
    >
      <NumberField label="Total to split" value={state.total} onChange={(total) => onChange({ ...state, total })} />
      <PartsEditor parts={state.parts} onChange={(parts) => onChange({ ...state, parts })} />
    </EditorSection>
  );
}

export function PercentagesPanel({ state, onChange }: PanelProps) {
  const comparison = state.percentage.kind === "comparison";
  return (
    <EditorSection
      title="Put the numbers in perspective"
      description="See each part’s share of the whole, or compare one number directly with another."
    >
      <div className="flex flex-wrap gap-2" role="group" aria-label="Percentage calculation">
        {(["shares", "comparison"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            className={`${buttonClass} ${state.percentage.kind === kind ? "border-accent/40 text-accent bg-accent/10" : ""}`}
            aria-pressed={state.percentage.kind === kind}
            onClick={() => onChange({ ...state, percentage: { ...state.percentage, kind } })}
          >
            {kind === "shares" ? "Share of total" : "Compare two values"}
          </button>
        ))}
      </div>
      {comparison ? (
        <>
          <NumberField
            label="Value"
            value={state.percentage.first}
            onChange={(first) => onChange({ ...state, percentage: { ...state.percentage, first } })}
          />
          <NumberField
            label="As a percentage of"
            value={state.percentage.second}
            onChange={(second) => onChange({ ...state, percentage: { ...state.percentage, second } })}
          />
          <p className="text-[12px] text-text-muted">
            2 compared with 3 is 66.67%. A part of 2 in a 2:3 split is 40% of the total.
          </p>
        </>
      ) : (
        <PartsEditor parts={state.parts} onChange={(parts) => onChange({ ...state, parts })} />
      )}
    </EditorSection>
  );
}
