import type { Edge } from "@xyflow/react";

export const DIAGRAM_FONT = "ui-monospace, SFMono-Regular, Menlo, monospace";
export const DIAGRAM_EDGE_TYPE = "smoothstep";

export function diagramEdgeStyle(highlighted = false) {
  return { stroke: highlighted ? "#a78bfa" : "var(--diagram-edge, #555)", strokeWidth: highlighted ? 2.5 : 1.5 };
}

/** Follows incoming links to the root, independent of node contents or layout direction. */
export function ancestorEdgeIds(edges: Edge[], nodeId: string | null): Set<string> {
  const incoming = new Map(edges.map((edge) => [edge.target, edge]));
  const path = new Set<string>();
  let edge = nodeId ? incoming.get(nodeId) : undefined;
  while (edge && !path.has(edge.id)) {
    path.add(edge.id);
    edge = incoming.get(edge.source);
  }
  return path;
}
