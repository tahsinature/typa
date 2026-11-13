import { ancestorEdgeIds, diagramEdgeStyle } from "@/components/diagram/diagram-style";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReactFlow, Background, MiniMap, getViewportForBounds, type ReactFlowInstance } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toBlob } from "html-to-image";
import { isTauri } from "@tauri-apps/api/core";
import { saveImageFile } from "@/lib/image-file";
import type { Hierarchy, HierarchyNode } from "@typa/engine";
import { TreeIcon } from "./icons";
import { HierarchyTreeNode } from "./tree-node";
import { ViewportSync } from "./viewport-sync";
import { useBalancedLayout } from "./use-balanced-layout";
import { GroupCard } from "./group-card";
import { isLeavesId } from "./tree-layout";
import { countNode, formatCount, layoutHierarchy, OVERVIEW_ID, totalCount, type CountMode, type DiagramNode, type Direction } from "./model";

const nodeTypes = { hierarchy: HierarchyTreeNode, groupCard: GroupCard };
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
  const computedGraph = useMemo(() => layoutHierarchy(tree, collapsed, query, direction, compact), [tree, collapsed, query, direction, compact]);
  const { graph, fitBounds, rearrange, reset, onNodesChange } = useBalancedLayout(tree, compact, computedGraph, direction === "BALANCED");
  const nodes = useMemo<DiagramNode[]>(() => {
    const searching = !!query.trim();
    const count = (entry: Parameters<typeof countNode>[0]) => countNode(entry, countMode);
    return graph.nodes.map(({ id, kind, entry, sections, position, width, height, sourcePosition, targetPosition }): DiagramNode => {
      const base = { id, position, width, height, sourcePosition, targetPosition, selected: id === selectedId, draggable: direction === "BALANCED", dragHandle: ".diagram-node-header", connectable: false };
      const color = entry ? graph.colors.get(entry.id)! : "var(--cl-accent)";
      if (kind === "card" || kind === "leaves") {
        const toRow = (row: HierarchyNode, parent: HierarchyNode | null) => ({
          entry: row,
          indent: parent ? row.depth - parent.depth - 1 : 0,
          collapsed: !searching && collapsed.has(row.id),
          match: graph.matches.has(row.id),
          count: count(row),
        });
        const shown = sections.flatMap((section) => [...(section.heading ? [section.heading] : []), ...section.columns.flat()]);
        return {
          ...base,
          type: "groupCard",
          ariaLabel: entry ? `${entry.name}, ${formatCount(count(entry))} ${countMode}` : `${shown.length} entries`,
          selectable: !!entry,
          data: {
            entry,
            color: entry ? color : graph.colors.get(shown[0].id)!,
            collapsed: !searching && collapsed.has(id),
            match: graph.matches.has(id),
            count: entry ? count(entry) : 0,
            sections: sections.map(({ heading, columns }) => ({
              heading: heading && toRow(heading, entry),
              columns: columns.map((column) => column.map((row) => toRow(row, heading ?? entry))),
            })),
            targetPosition: direction === "BALANCED" ? null : targetPosition,
            selectedRowId: selectedId && shown.some((row) => row.id === selectedId) ? selectedId : null,
            onToggle,
            onSelect,
          },
        };
      }
      return {
        ...base,
        type: "hierarchy",
        ariaLabel: entry ? `${entry.name}, ${formatCount(count(entry))} ${countMode}` : "Hierarchy overview",
        data: {
          entry,
          name: entry?.name ?? "All entries",
          color,
          sourcePosition,
          targetPosition,
          showHandles: direction !== "BALANCED",
          collapsed: !searching && collapsed.has(id),
          match: graph.matches.has(id),
          count: entry ? count(entry) : totalCount(tree, countMode),
          mode: countMode,
          onToggle,
        },
      };
    });
  }, [graph, selectedId, collapsed, query, countMode, tree, direction, onToggle, onSelect]);

  const edges = useMemo(() => {
    const selectedNode = graph.nodes.find((node) => node.id === selectedId || node.sections.some((section) =>
      section.heading?.id === selectedId || section.columns.some((column) => column.some((entry) => entry.id === selectedId)),
    ));
    const path = ancestorEdgeIds(graph.edges, selectedNode?.id ?? null);
    return graph.edges.map((edge) => ({ ...edge, style: diagramEdgeStyle(path.has(edge.id)), animated: path.has(edge.id), zIndex: path.has(edge.id) ? 1 : 0 }));
  }, [graph, selectedId]);

  const fit = useCallback(() => {
    void instance?.fitView({ padding: 0.18, duration: 250, maxZoom: 1 });
  }, [instance]);
  const exportPng = useCallback(async () => {
    const viewport = container.current?.querySelector<HTMLElement>(".react-flow__viewport");
    if (!viewport || !instance) throw new Error("The tree is not ready to export.");
    const bounds = graph.bounds;
    // Export the entire visible tree, independent of the current pan and zoom.
    const scale = Math.min(1, 3000 / Math.max(bounds.width + 120, bounds.height + 120));
    const width = Math.max(320, Math.ceil((bounds.width + 120) * scale));
    const height = Math.max(200, Math.ceil((bounds.height + 120) * scale));
    const view = getViewportForBounds(bounds, width, height, 0.001, 2, 0.12);
    const image = await toBlob(viewport, {
      width,
      height,
      pixelRatio: 2,
      backgroundColor: getComputedStyle(container.current!).getPropertyValue("--bg").trim(),
      style: { width: `${width}px`, height: `${height}px`, transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` },
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
  }, [instance, graph.bounds]);
  useEffect(() => {
    onReady(instance ? { fit, exportPng } : null);
    return () => onReady(null);
  }, [instance, fit, exportPng, onReady]);
  return (
    <div className={`ht-canvas diagram-canvas ${compact ? "ht-compact" : ""}`} ref={container} aria-label="Hierarchy diagram">
      <ReactFlow<DiagramNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={setInstance}
        onNodesChange={onNodesChange}
        onNodeClick={(_, node) => !isLeavesId(node.id) && onSelect(node.id === OVERVIEW_ID ? null : node.id)}
        onPaneClick={() => onSelect(null)}
        nodesDraggable={direction === "BALANCED"}
        nodesConnectable={false}
        edgesFocusable={false}
        deleteKeyCode={null}
        minZoom={0.02}
        maxZoom={2}
        colorMode={theme}
      >
        <Background color="var(--cl-border-subtle)" gap={24} size={1} />
        <ViewportSync graph={graph} fitBounds={fitBounds} stable={direction === "BALANCED"} selectedId={selectedId} />
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
      <div className="ht-canvas-controls">
        {direction === "BALANCED" && (
          <>
            <button type="button" className="ht-layout-button" title="Pack cards using their current sizes" onClick={rearrange}>Rearrange</button>
            <button type="button" className="ht-layout-button" title="Restore initial positions without changing expanded sections" onClick={reset}>Reset layout</button>
            <span />
          </>
        )}
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
