import { useMemo } from "react";
import type { Hierarchy, HierarchyNode } from "@typa/engine";
import { TreeIcon } from "./icons";
import { hierarchyColors, formatCount, getAncestors } from "./model";

export function NodeInspector({ tree, selectedId, onSelect, onClose }: { tree: Hierarchy; selectedId: string; onSelect: (id: string) => void; onClose: () => void }) {
  const byId = useMemo(() => new Map(tree.nodes.map((entry) => [entry.id, entry])), [tree]);
  const colors = useMemo(() => hierarchyColors(tree), [tree]);
  const node = byId.get(selectedId);
  if (!node) return null;
  const path = getAncestors(node.id, byId);
  return (
    <aside className="ht-inspector" aria-label="Selected entry details">
      <div className="ht-panel-heading">
        <span>Entry details</span>
        <button type="button" className="ht-icon-button" onClick={onClose} aria-label="Close entry details">
          <TreeIcon name="close" />
        </button>
      </div>
      <div className="ht-inspector-content">
        <span className="ht-inspector-symbol" style={{ color: colors.get(node.id) }}>
          <TreeIcon name={node.children.length ? "tree" : "leaf"} width={28} height={28} />
        </span>
        <span className="ht-eyebrow">
          {node.children.length ? "Group" : "Leaf entry"} · Level {node.depth + 1}
        </span>
        <h2>{node.name}</h2>
        {node.line !== null && <span className="ht-source-reference">Source line {node.line}</span>}
        <div className="ht-inspector-stats">
          <Detail label="Leaves" value={node.leafCount} />
          <Detail label="All entries" value={node.nodeCount} />
          <Detail label="Leaf quantity" value={node.quantityTotal} />
          <Detail label="Direct children" value={node.children.length} />
        </div>
        <section>
          <h3>Path to this entry</h3>
          <nav className="ht-breadcrumb" aria-label="Entry ancestors">
            {path.map((entry, index) => (
              <button key={entry.id} type="button" onClick={() => onSelect(entry.id)} aria-current={entry.id === node.id ? "location" : undefined}>
                <span className="ht-path-rail" aria-hidden="true">
                  {index === path.length - 1 ? "●" : "○"}
                </span>
                <span>{entry.name}</span>
              </button>
            ))}
          </nav>
        </section>
        {node.children.length > 0 && (
          <section>
            <h3>
              Direct children <span>{node.children.length}</span>
            </h3>
            <div className="ht-child-list">
              {node.children.map((id) => (
                <Child key={id} node={byId.get(id)!} onSelect={onSelect} />
              ))}
            </div>
          </section>
        )}
        <p className="ht-inspector-note">
          {node.children.length
            ? "All entries includes this group. Leaf counts and quantities include its full branch, even when collapsed."
            : `This leaf counts as one entry and contributes ${formatCount(node.quantity)} to quantity totals.`}
        </p>
      </div>
    </aside>
  );
}
function Detail({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <strong>{formatCount(value)}</strong>
      <span>{label}</span>
    </div>
  );
}
function Child({ node, onSelect }: { node: HierarchyNode; onSelect: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onSelect(node.id)}>
      <TreeIcon name={node.children.length ? "tree" : "leaf"} width={13} height={13} />
      <span>{node.name}</span>
      <small>{formatCount(node.leafCount)}</small>
      <TreeIcon name="chevron" width={12} height={12} />
    </button>
  );
}
