import type { layoutHierarchy } from "./model";

type Graph = ReturnType<typeof layoutHierarchy>;
export type BoardPositions = Map<string, { x: number; y: number }>;

export function boardPositions(graph: Graph): BoardPositions {
  return new Map(graph.nodes.map((node) => [node.id, node.position]));
}

/** Keep the content and sizes current while retaining each card's saved position. */
export function applyBoardPositions(graph: Graph, positions: BoardPositions): Graph {
  const anchors = new Map(graph.anchors);
  const nodes = graph.nodes.map((node) => {
    const position = positions.get(node.id) ?? node.position;
    const dx = position.x - node.position.x;
    const dy = position.y - node.position.y;
    const ids = [node.id, ...node.sections.flatMap((section) => [
      ...(section.heading ? [section.heading.id] : []),
      ...section.columns.flat().map((entry) => entry.id),
    ])];
    for (const id of ids) {
      const anchor = anchors.get(id);
      if (anchor) anchors.set(id, { x: anchor.x + dx, y: anchor.y + dy });
    }
    return { ...node, position };
  });
  // Export bounds follow actual card sizes, including a card expanded after rearranging.
  const x = Math.min(0, ...nodes.map((node) => node.position.x - 32));
  const y = Math.min(0, ...nodes.map((node) => node.position.y - 32));
  const width = Math.max(1, ...nodes.map((node) => node.position.x + node.width + 32)) - x;
  const height = Math.max(1, ...nodes.map((node) => node.position.y + node.height + 32)) - y;
  return { ...graph, nodes, anchors, bounds: { x, y, width, height } };
}
