import { BaseEdge, type EdgeProps } from "@xyflow/react";

export function BalancedEdge({ sourceX, sourceY, targetX, targetY, data, style, ...props }: EdgeProps) {
  const rail = typeof data?.railX === "number" ? data.railX : sourceX - 14;
  let path: string;
  if (data?.kind === "header") path = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  else if (data?.kind === "overview") {
    path = `M ${sourceX} ${sourceY} V ${sourceY + 32} H ${rail} V ${targetY - 18} H ${targetX} V ${targetY}`;
  } else if (data?.kind === "group") {
    path = `M ${sourceX} ${sourceY} V ${sourceY + 18} H ${rail} V ${targetY} H ${targetX}`;
  } else path = `M ${sourceX} ${sourceY} H ${rail} V ${targetY} H ${targetX}`;
  return <BaseEdge id={props.id} path={path} style={style} interactionWidth={0} />;
}
