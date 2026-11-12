import { useId, type RefObject } from "react";
import type { Hierarchy } from "@typa/engine";
import { TreeIcon } from "./icons";
import { countLabels, formatCount, totalCount, type CountMode, type Direction } from "./model";

export function TreeSummary({ tree, mode, onModeChange }: { tree: Hierarchy; mode: CountMode; onModeChange: (mode: CountMode) => void }) {
  const countId = useId();
  return (
    <section className="ht-summary" aria-label="Hierarchy counts">
      <div className="ht-summary-main">
        <span className="ht-summary-value">{formatCount(totalCount(tree, mode))}</span>
        <div>
          <span>{mode === "leaves" ? "leaf entries" : mode === "nodes" ? "total entries" : "leaf quantity"}</span>
          <small>{mode === "leaves" ? "Entries without children" : mode === "nodes" ? "Groups and leaves combined" : "Quantities summed across leaves"}</small>
        </div>
      </div>
      <div className="ht-summary-detail">
        <TreeIcon name="tree" />
        <strong>{tree.groups}</strong>
        <span>groups</span>
      </div>
      <div className="ht-summary-detail">
        <TreeIcon name="layers" />
        <strong>{tree.nodes.length}</strong>
        <span>entries</span>
      </div>
      <div className="ht-summary-detail">
        <span className="ht-depth-mark">↳</span>
        <strong>{tree.depth}</strong>
        <span>levels</span>
      </div>
      <div className="ht-count-control">
        <label htmlFor={countId}>COUNT</label>
        <select id={countId} value={mode} onChange={(event) => onModeChange(event.target.value as CountMode)}>
          {Object.entries(countLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}

interface ToolbarProps {
  view: "diagram" | "outline";
  direction: Direction;
  compact: boolean;
  query: string;
  ready: boolean;
  searchRef: RefObject<HTMLInputElement | null>;
  onViewChange: (view: "diagram" | "outline") => void;
  onDirectionChange: (direction: Direction) => void;
  onQueryChange: (query: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onToggleCompact: () => void;
}
export function TreeToolbar({
  view,
  direction,
  compact,
  query,
  ready,
  searchRef,
  onViewChange,
  onDirectionChange,
  onQueryChange,
  onExpandAll,
  onCollapseAll,
  onToggleCompact,
}: ToolbarProps) {
  return (
    <div className="ht-toolbar">
      <div className="ht-toolbar-start">
        <div className="ht-segment" aria-label="View mode">
          <button type="button" aria-pressed={view === "diagram"} onClick={() => onViewChange("diagram")}>
            <TreeIcon name="tree" />
            Tree
          </button>
          <button type="button" aria-pressed={view === "outline"} onClick={() => onViewChange("outline")}>
            <TreeIcon name="list" />
            Outline
          </button>
        </div>
        <span className="ht-toolbar-divider" />
        <div className="ht-segment ht-direction" aria-label="Tree direction">
          <button
            type="button"
            aria-pressed={direction === "BALANCED"}
            onClick={() => onDirectionChange("BALANCED")}
            title="Balanced groups: fit branches into a roughly square board"
            aria-label="Balanced groups"
          >
            <TreeIcon name="grid" />
            <span>Balanced</span>
          </button>
          <button type="button" aria-pressed={direction === "LR"} onClick={() => onDirectionChange("LR")} title="Left to right">
            <TreeIcon name="right" />
            <span>Left to right</span>
          </button>
          <button type="button" aria-pressed={direction === "TB"} onClick={() => onDirectionChange("TB")} title="Top down">
            <TreeIcon name="down" />
            <span>Top down</span>
          </button>
        </div>
      </div>
      <div className="ht-toolbar-end">
        <button type="button" className="ht-icon-button" title="Expand all branches" aria-label="Expand all branches" disabled={!ready} onClick={onExpandAll}>
          <TreeIcon name="expand" />
        </button>
        <button type="button" className="ht-icon-button" title="Collapse all groups" aria-label="Collapse all groups" disabled={!ready} onClick={onCollapseAll}>
          <TreeIcon name="collapse" />
        </button>
        <button
          type="button"
          className={`ht-icon-button ht-density ${compact ? "is-active" : ""}`}
          title="Compact spacing"
          aria-label="Compact spacing"
          aria-pressed={compact}
          onClick={onToggleCompact}
        >
          <TreeIcon name="layers" />
        </button>
        <label className="ht-search">
          <TreeIcon name="search" width={14} height={14} />
          <input ref={searchRef} aria-label="Search hierarchy" placeholder="Find an entry…" value={query} onChange={(event) => onQueryChange(event.target.value)} />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => onQueryChange("")}>
              <TreeIcon name="close" width={12} height={12} />
            </button>
          )}
        </label>
      </div>
    </div>
  );
}
