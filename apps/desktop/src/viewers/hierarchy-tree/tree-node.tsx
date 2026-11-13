import { memo } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { DiagramHandle, DiagramNodeFrame } from "@/components/diagram/DiagramNode";
import { HierarchyDiagramHeader } from "./diagram-header";
import { formatCount, type TreeNodeData } from "./model";

export const HierarchyTreeNode = memo(function HierarchyTreeNode({ data, selected }: NodeProps<Node<TreeNodeData, "hierarchy">>) {
  const group = !data.entry || data.entry.children.length > 0;
  return (
    <DiagramNodeFrame className="ht-node" highlight={selected ? "selected" : data.match ? "match" : "none"}>
      {data.showHandles && data.entry && <DiagramHandle type="target" position={data.targetPosition} />}
      <HierarchyDiagramHeader
        name={data.name}
        group={group}
        count={group || data.count !== 1 ? data.count : undefined}
        countTitle={`${formatCount(data.count)} ${data.mode === "nodes" ? (data.entry ? "entries including this node" : "source entries") : data.mode}`}
        collapsed={data.collapsed}
        onToggle={data.entry && group ? () => data.onToggle(data.entry!.id) : undefined}
        singleRow
      />
      {data.showHandles && group && <DiagramHandle type="source" position={data.sourcePosition} />}
    </DiagramNodeFrame>
  );
});
