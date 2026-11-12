import { useMemo, type CSSProperties } from "react";
import type { Hierarchy } from "@typa/engine";
import { TreeIcon } from "./icons";
import { hierarchyColors, countNode, formatCount, getAncestors, type CountMode } from "./model";

export function HierarchyOutline({
  tree,
  collapsed,
  query,
  mode,
  selectedId,
  onToggle,
  onSelect,
}: {
  tree: Hierarchy;
  collapsed: Set<string>;
  query: string;
  mode: CountMode;
  selectedId: string | null;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const colors = useMemo(() => hierarchyColors(tree), [tree]);
  const entries = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    const included = new Set<string>();
    const byId = new Map(tree.nodes.map((node) => [node.id, node]));
    if (search)
      for (const node of tree.nodes) {
        if (node.name.toLocaleLowerCase().includes(search)) {
          for (const ancestor of getAncestors(node.id, byId)) included.add(ancestor.id);
        }
      }
    const visible = new Set<string>();
    return tree.nodes.filter((node) => {
      const show = search ? included.has(node.id) : !node.parentId || (visible.has(node.parentId) && !collapsed.has(node.parentId));
      if (show) visible.add(node.id);
      return show;
    });
  }, [tree, collapsed, query]);
  return (
    <div className="ht-outline" aria-label="Hierarchy outline">
      <div className="ht-outline-header">
        <span>Entry / group</span>
        <span>{mode === "nodes" ? "All entries" : mode === "quantity" ? "Leaf quantity" : "Leaves"}</span>
      </div>
      {entries.length === 0 && <p className="ht-outline-empty">No matching entries.</p>}
      {entries.map((entry) => (
        <div
          key={entry.id}
          className={`ht-outline-row ${selectedId === entry.id ? "is-selected" : ""}`}
          style={{ "--branch-color": colors.get(entry.id), "--entry-depth": Math.min(entry.depth, 12) } as CSSProperties}
        >
          {entry.children.length ? (
            <button
              type="button"
              className="ht-outline-toggle"
              aria-label={`${collapsed.has(entry.id) && !query.trim() ? "Expand" : "Collapse"} ${entry.name}`}
              aria-expanded={!collapsed.has(entry.id) || !!query.trim()}
              onClick={() => onToggle(entry.id)}
            >
              <TreeIcon name="chevron" className={!collapsed.has(entry.id) || query.trim() ? "ht-rotated" : ""} width={12} height={12} />
            </button>
          ) : (
            <span className="ht-outline-dot" />
          )}
          <button type="button" className="ht-outline-label" onClick={() => onSelect(entry.id)}>
            <TreeIcon name={entry.children.length ? "tree" : "leaf"} width={15} height={15} />
            <span>{entry.name}</span>
            {entry.children.length > 0 && <small>{entry.children.length} children</small>}
          </button>
          <span className="ht-outline-count">{formatCount(countNode(entry, mode))}</span>
        </div>
      ))}
    </div>
  );
}
