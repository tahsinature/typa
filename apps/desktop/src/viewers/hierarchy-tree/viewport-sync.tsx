import { useEffect, useRef } from "react";
import { useReactFlow, useStore, getViewportForBounds } from "@xyflow/react";
import type { layoutHierarchy } from "./model";

export function ViewportSync({ graph, fitBounds, stable, selectedId }: { graph: ReturnType<typeof layoutHierarchy>; fitBounds: ReturnType<typeof layoutHierarchy>["bounds"]; stable: boolean; selectedId: string | null }) {
  const { setViewport, getViewport } = useReactFlow();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const anchor = selectedId ? graph.anchors.get(selectedId) : undefined;
  const anchorX = anchor?.x ?? null;
  const anchorY = anchor?.y ?? null;
  const boundsWidth = fitBounds.width;
  const boundsHeight = fitBounds.height;
  const previousSelection = useRef<string | null>(null);
  const hasNodes = graph.nodes.length > 0;
  const hasSelection = useRef(false);
  hasSelection.current = selectedId !== null;
  const duration = () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 200);

  // Fit the whole tree when its shape changes, unless the user is focused on a selection.
  useEffect(() => {
    if (!width || !height || !hasNodes || hasSelection.current) return;
    void setViewport(getViewportForBounds({ x: 0, y: 0, width: boundsWidth, height: boundsHeight }, width, height, 0.02, 1, 0.18), { duration: duration() });
  }, [hasNodes, boundsWidth, boundsHeight, width, height, setViewport]);

  // Only pan to the selection when it is off-screen, so clicking a visible entry never moves the view.
  useEffect(() => {
    const unchangedSelection = previousSelection.current === selectedId;
    previousSelection.current = selectedId;
    if (stable && unchangedSelection) return;
    if (!width || !height || anchorX === null || anchorY === null) return;
    const { x, y, zoom } = getViewport();
    const screenX = anchorX * zoom + x;
    const screenY = anchorY * zoom + y;
    const margin = 40;
    if (screenX > margin && screenX < width - margin && screenY > margin && screenY < height - margin) return;
    void setViewport({ x: width / 2 - anchorX * zoom, y: height / 2 - anchorY * zoom, zoom }, { duration: duration() });
  }, [anchorX, anchorY, selectedId, stable, width, height, getViewport, setViewport]);
  return null;
}
