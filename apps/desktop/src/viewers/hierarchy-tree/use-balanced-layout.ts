import { useCallback, useMemo, useState } from "react";
import type { Hierarchy } from "@typa/engine";
import type { NodeChange } from "@xyflow/react";
import { layoutHierarchy, type DiagramNode } from "./model";
import { applyBoardPositions, boardPositions } from "./board-positions";

type Graph = ReturnType<typeof layoutHierarchy>;

export function useBalancedLayout(tree: Hierarchy, compact: boolean, computed: Graph, enabled: boolean) {
  // The initial expanded board supplies positions even for cards initially hidden by a collapsed root.
  const initial = useMemo(() => layoutHierarchy(tree, new Set(), "", "BALANCED", compact), [tree, compact]);
  const [saved, setSaved] = useState(() => ({ initial, positions: boardPositions(initial), bounds: initial.bounds }));
  let arrangement = saved;
  if (saved.initial !== initial) {
    arrangement = { initial, positions: boardPositions(initial), bounds: initial.bounds };
    setSaved(arrangement);
  }
  const graph = useMemo(() => enabled ? applyBoardPositions(computed, arrangement.positions) : computed, [computed, arrangement.positions, enabled]);
  const onNodesChange = useCallback((changes: NodeChange<DiagramNode>[]) => {
    if (!enabled) return;
    const moved = changes.filter((change) => change.type === "position" && change.position);
    if (!moved.length) return;
    setSaved((previous) => {
      const positions = new Map(previous.positions);
      for (const change of moved) {
        if (change.type === "position" && change.position) positions.set(change.id, change.position);
      }
      return { ...previous, positions };
    });
  }, [enabled]);
  return {
    graph,
    onNodesChange,
    fitBounds: enabled ? arrangement.bounds : graph.bounds,
    rearrange: () => setSaved({ initial, positions: new Map([...arrangement.positions, ...boardPositions(computed)]), bounds: computed.bounds }),
    reset: () => setSaved({ initial, positions: boardPositions(initial), bounds: initial.bounds }),
  };
}
