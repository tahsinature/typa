import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReactFlow, Background, MiniMap, ViewportPortal, useReactFlow, useStore, getNodesBounds, getViewportForBounds, type ReactFlowInstance } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toBlob } from "html-to-image";
import { isTauri } from "@tauri-apps/api/core";
import { saveImageFile } from "@/lib/image-file";
import type { Hierarchy } from "@typa/engine";
import { TreeIcon } from "./icons";
import { HierarchyTreeNode } from "./tree-node";
import { BalancedEdge } from "./balanced-edge";
import { branchColors, countNode, formatCount, layoutHierarchy, OVERVIEW_ID, totalCount, type CountMode, type DiagramNode, type Direction } from "./model";

const nodeTypes = { hierarchy: HierarchyTreeNode };
const edgeTypes = { balanced: BalancedEdge };
export interface CanvasActions {
  fit: () => void;
  exportPng: () => Promise<void>;
}
interface Props {
  tree: Hierarchy;
  collapsed: Set<string>;
  query: string;
  direction: Direction;
  compact: boolean;
  countMode: CountMode;
  selectedId: string | null;
  theme: "dark" | "light";
  onToggle: (id: string) => void;
  onSelect: (id: string | null) => void;
  onReady: (actions: CanvasActions | null) => void;
}
export function TreeCanvas(props: Props) {
  const { tree, collapsed, query, direction, compact, countMode, selectedId, theme, onToggle, onSelect, onReady } = props;
  const container = useRef<HTMLDivElement>(null);
  const [instance, setInstance] = useState<ReactFlowInstance<DiagramNode> | null>(null);
  const [minimap, setMinimap] = useState(false);
  const graph = useMemo(() => layoutHierarchy(tree, collapsed, query, direction, compact), [tree, collapsed, query, direction, compact]);
  const nodes = useMemo<DiagramNode[]>(
    () =>
      graph.nodes.map(({ entry, ...node }) => ({
        ...node,
        type: "hierarchy",
        width: 244,
        height: compact ? 72 : 88,
        selected: node.id === selectedId,
        draggable: false,
        connectable: false,
        ariaLabel: entry ? `${entry.name}, ${formatCount(countNode(entry, countMode))} ${countMode}` : "Hierarchy overview",
        data: {
          entry,
          name: entry?.name ?? "All entries",
          color: entry ? graph.colors.get(entry.id)! : "var(--cl-accent)",
          direction,
          sourcePosition: node.sourcePosition,
          targetPosition: node.targetPosition,
          collapsed: !query.trim() && collapsed.has(node.id),
          match: graph.matches.has(node.id),
          count: entry ? countNode(entry, countMode) : totalCount(tree, countMode),
          mode: countMode,
          onToggle,
        },
      })),
    [graph, selectedId, direction, collapsed, query, countMode, tree, onToggle, compact],
  );

  const fit = useCallback(() => {
    void instance?.fitView({ padding: 0.18, duration: 250, maxZoom: 1 });
  }, [instance]);
  const exportPng = useCallback(async () => {
    const viewport = container.current?.querySelector<HTMLElement>(".react-flow__viewport");
    if (!viewport || !instance) throw new Error("The tree is not ready to export.");
    const bounds = direction === "BALANCED" ? graph.bounds : getNodesBounds(instance.getNodes());
    // Export the entire visible tree, independent of the current pan and zoom.
    const scale = Math.min(1, 4096 / Math.max(bounds.width + 120, bounds.height + 120));
    const width = Math.max(320, Math.ceil((bounds.width + 120) * scale));
    const height = Math.max(200, Math.ceil((bounds.height + 120) * scale));
    const view = getViewportForBounds(bounds, width, height, 0.001, 2, 0.12);
    const image = await toBlob(viewport, {
      width,
      height,
      pixelRatio: 1.5,
      backgroundColor: getComputedStyle(container.current!).getPropertyValue("--bg").trim(),
      style: { width: `${width}px`, height: `${height}px`, transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` },
      filter: (node) => !(node instanceof HTMLElement && node.classList.contains("ht-node-toggle")),
    });
    if (!image) throw new Error("Unable to create the image. Try collapsing some branches.");
    if (isTauri()) await saveImageFile(image, "Hierarchy");
    else {
      const url = URL.createObjectURL(image);
      const link = document.createElement("a");
      link.href = url;
      link.download = "hierarchy-tree.png";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }, [instance, direction, graph.bounds]);
  useEffect(() => {
    onReady(instance ? { fit, exportPng } : null);
    return () => onReady(null);
  }, [instance, fit, exportPng, onReady]);
  return (
    <div className={`ht-canvas ${compact ? "ht-compact" : ""}`} ref={container} aria-label="Hierarchy diagram">
      <ReactFlow<DiagramNode>
        nodes={nodes}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={setInstance}
        onNodeClick={(_, node) => onSelect(node.id === OVERVIEW_ID ? null : node.id)}
        onPaneClick={() => onSelect(null)}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        deleteKeyCode={null}
        minZoom={0.02}
        maxZoom={2}
        colorMode={theme}
      >
        <Background color="var(--cl-border-subtle)" gap={24} size={1} />
        <ViewportPortal>
          {graph.groups.map((group) => (
            <div
              key={group.id}
              className="ht-balanced-group"
              style={{
                left: group.x,
                top: group.y,
                width: group.width,
                height: group.height,
                borderColor: `color-mix(in srgb, ${graph.colors.get(group.id)} 28%, var(--cl-border-subtle))`,
              }}
            />
          ))}
        </ViewportPortal>
        <ViewportSync graph={graph} selectedId={selectedId} compact={compact} />
        {minimap && (
          <MiniMap
            pannable
            zoomable
            position="bottom-left"
            nodeColor={(node) => String(node.data.color)}
            maskColor="color-mix(in srgb, var(--bg) 85%, transparent)"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--cl-border-subtle)", borderRadius: 10 }}
          />
        )}
      </ReactFlow>
      {query.trim() && (
        <div className="ht-search-summary" role="status">
          {graph.matches.size ? `${graph.matches.size} ${graph.matches.size === 1 ? "match" : "matches"} · showing matching paths` : "No matching entries"}
        </div>
      )}
      {graph.truncated && (
        <div className="ht-limit-notice" role="status">
          Showing 600 of {graph.eligibleCount.toLocaleString()} expanded entries. Collapse branches or search to explore the rest. Totals include every entry.
        </div>
      )}
      <div className="ht-canvas-legend">
        <span style={{ background: "var(--cl-accent)" }} /> Overview
        <span style={{ background: branchColors[0] }} /> Group
        <span className="ht-legend-leaf" /> Leaf
      </div>
      <div className="ht-canvas-controls">
        <button
          type="button"
          className={`ht-icon-button ${minimap ? "is-active" : ""}`}
          aria-label="Toggle minimap"
          aria-pressed={minimap}
          onClick={() => setMinimap((value) => !value)}
          title="Minimap"
        >
          <TreeIcon name="map" />
        </button>
        <span />
        <button type="button" className="ht-icon-button" aria-label="Zoom out" onClick={() => void instance?.zoomOut({ duration: 150 })}>
          <TreeIcon name="minus" />
        </button>
        <button type="button" className="ht-icon-button" aria-label="Zoom in" onClick={() => void instance?.zoomIn({ duration: 150 })}>
          <TreeIcon name="plus" />
        </button>
        <button type="button" className="ht-icon-button" aria-label="Fit tree to view" title="Fit tree to view" onClick={fit}>
          <TreeIcon name="fit" />
        </button>
      </div>
    </div>
  );
}

function ViewportSync({ graph, selectedId, compact }: { graph: ReturnType<typeof layoutHierarchy>; selectedId: string | null; compact: boolean }) {
  const { setViewport, getZoom } = useReactFlow();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const selected = graph.nodes.find((node) => node.id === selectedId);
  const centerX = selected ? selected.position.x + 122 : null;
  const centerY = selected ? selected.position.y + (compact ? 36 : 44) : null;
  const boundsWidth = graph.bounds.width;
  const boundsHeight = graph.bounds.height;
  const hasNodes = graph.nodes.length > 0;
  useEffect(() => {
    if (!width || !height || !hasNodes) return;
    const zoom = Math.max(getZoom(), 0.8);
    const viewport =
      centerX !== null && centerY !== null
        ? {
            x: width / 2 - centerX * zoom,
            y: height / 2 - centerY * zoom,
            zoom,
          }
        : getViewportForBounds({ x: 0, y: 0, width: boundsWidth, height: boundsHeight }, width, height, 0.02, 1, 0.18);
    // Use the new geometry rather than React Flow's previous internal node positions.
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 200;
    void setViewport(viewport, { duration });
  }, [hasNodes, selectedId, centerX, centerY, boundsWidth, boundsHeight, width, height, setViewport, getZoom]);
  return null;
}
