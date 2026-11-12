import { memo, type CSSProperties } from "react";
import { Handle, type Node, type NodeProps } from "@xyflow/react";
import { TreeIcon } from "./icons";
import { formatCount, type TreeNodeData } from "./model";

export const HierarchyTreeNode = memo(function HierarchyTreeNode({ data, selected }: NodeProps<Node<TreeNodeData, "hierarchy">>) {
  const group = !data.entry || data.entry.children.length > 0;
  return (
    <div
      className={`ht-node ${!data.entry ? "ht-node-root" : ""} ${selected ? "ht-node-selected" : ""} ${data.match ? "ht-node-match" : ""}`}
      style={{ "--branch-color": data.color } as CSSProperties}
    >
      {data.entry && <Handle type="target" position={data.targetPosition} isConnectable={false} />}
      <div className="ht-node-body">
        <span className="ht-node-icon">
          <TreeIcon name={group ? "tree" : "leaf"} width={13} height={13} />
        </span>
        <span className="ht-node-name" title={!data.entry ? "Overview · excluded from counts" : data.name}>
          {data.name}
        </span>
        {(group || data.count !== 1) && (
          <span
            className="ht-node-count"
            title={`${formatCount(data.count)} ${data.mode === "nodes" ? (data.entry ? "entries including this node" : "source entries") : data.mode}`}
          >
            {formatCount(data.count)}
          </span>
        )}
      </div>
      {data.entry && group && (
        <button
          type="button"
          className="ht-node-toggle nodrag nopan"
          aria-label={`${data.collapsed ? "Expand" : "Collapse"} ${data.name}`}
          aria-expanded={!data.collapsed}
          onClick={(event) => {
            event.stopPropagation();
            data.onToggle(data.entry!.id);
          }}
        >
          <TreeIcon name={data.collapsed ? "plus" : "minus"} width={11} height={11} />
        </button>
      )}
      {group && <Handle type="source" position={data.sourcePosition} isConnectable={false} />}
    </div>
  );
});
