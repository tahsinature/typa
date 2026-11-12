import type { ReactNode, RefObject } from "react";
import type { Hierarchy } from "@typa/engine";
import { TreeIcon, type TreeIconName } from "./icons";
import { countLabels, formatCount, totalCount, type CountMode, type Direction } from "./model";

export function TreeStats({ tree, mode, onModeChange }: { tree: Hierarchy; mode: CountMode; onModeChange: (mode: CountMode) => void }) {
  return (
    <div className="ht-stats" aria-label="Hierarchy counts">
      <strong>{formatCount(totalCount(tree, mode))}</strong>
      <select aria-label="What to count" value={mode} onChange={(event) => onModeChange(event.target.value as CountMode)}>
        {Object.entries(countLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label.toLowerCase()}
          </option>
        ))}
      </select>
      <span className="ht-stats-detail">
        · {tree.groups} {tree.groups === 1 ? "group" : "groups"} · {tree.depth} {tree.depth === 1 ? "level" : "levels"}
      </span>
    </div>
  );
}

interface ToolbarProps {
  view: "diagram" | "outline";
  direction: Direction;
  compact: boolean;
  query: string;
  ready: boolean;
  sourceOpen: boolean;
  searchRef: RefObject<HTMLInputElement | null>;
  stats: ReactNode;
  actions: ReactNode;
  onToggleSource: () => void;
  onViewChange: (view: "diagram" | "outline") => void;
  onDirectionChange: (direction: Direction) => void;
  onQueryChange: (query: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onToggleCompact: () => void;
}
const directions: { value: Direction; icon: TreeIconName; label: string }[] = [
  { value: "BALANCED", icon: "grid", label: "Balanced board" },
  { value: "LR", icon: "right", label: "Left to right" },
  { value: "TB", icon: "down", label: "Top down" },
];
export function TreeToolbar(props: ToolbarProps) {
  const { view, direction, compact, query, ready, sourceOpen, searchRef } = props;
  return (
    <header className="ht-toolbar">
      <div className="ht-toolbar-start">
        <button
          type="button"
          className={`ht-icon-button ${sourceOpen ? "is-active" : ""}`}
          aria-label="Outline editor panel"
          aria-pressed={sourceOpen}
          title="Toggle editor panel"
          onClick={props.onToggleSource}
        >
          <TreeIcon name="panel" />
        </button>
        <div className="ht-segment" aria-label="View mode">
          <button type="button" aria-pressed={view === "diagram"} onClick={() => props.onViewChange("diagram")}>
            <TreeIcon name="tree" />
            Tree
          </button>
          <button type="button" aria-pressed={view === "outline"} onClick={() => props.onViewChange("outline")}>
            <TreeIcon name="list" />
            Outline
          </button>
        </div>
        {view === "diagram" && (
          <div className="ht-segment ht-direction" aria-label="Tree layout">
            {directions.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={direction === item.value}
                onClick={() => props.onDirectionChange(item.value)}
                title={item.label}
                aria-label={item.label}
              >
                <TreeIcon name={item.icon} />
              </button>
            ))}
          </div>
        )}
        <span className="ht-toolbar-divider" />
        {props.stats}
      </div>
      <div className="ht-toolbar-end">
        <button type="button" className="ht-icon-button" title="Expand all branches" aria-label="Expand all branches" disabled={!ready} onClick={props.onExpandAll}>
          <TreeIcon name="expand" />
        </button>
        <button type="button" className="ht-icon-button" title="Collapse all groups" aria-label="Collapse all groups" disabled={!ready} onClick={props.onCollapseAll}>
          <TreeIcon name="collapse" />
        </button>
        <button
          type="button"
          className={`ht-icon-button ht-density ${compact ? "is-active" : ""}`}
          title="Compact spacing"
          aria-label="Compact spacing"
          aria-pressed={compact}
          onClick={props.onToggleCompact}
        >
          <TreeIcon name="layers" />
        </button>
        <label className="ht-search">
          <TreeIcon name="search" width={14} height={14} />
          <input ref={searchRef} aria-label="Search hierarchy" placeholder="Find…  ⌘F" value={query} onChange={(event) => props.onQueryChange(event.target.value)} />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => props.onQueryChange("")}>
              <TreeIcon name="close" width={12} height={12} />
            </button>
          )}
        </label>
        {props.actions}
      </div>
    </header>
  );
}
