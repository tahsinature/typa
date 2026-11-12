import { useCallback, useDeferredValue, useMemo, useRef, useState } from "react";
import { hierarchyToJson, parseHierarchy } from "@typa/engine";
import { useTabId } from "@/lib/tab-context";
import { registerOutputView } from "../registry";
import { EmptyHierarchy } from "./empty-state";
import { TreeIcon } from "./icons";
import { NodeInspector } from "./inspector";
import { getAncestors, initialCollapsed, type CountMode, type Direction } from "./model";
import { HierarchyOutline } from "./outline";
import { SourcePanel } from "./source-panel";
import { WorkspaceActions } from "./workspace-header";
import { TreeStats, TreeToolbar } from "./workspace-controls";
import { TreeCanvas, type CanvasActions } from "./tree-canvas";

function HierarchyWorkspace({ input = "", onInputChange, theme }: { data: string; input?: string; onInputChange?: (value: string) => void; theme: "dark" | "light" }) {
  const deferredInput = useDeferredValue(input);
  const tree = useMemo(() => parseHierarchy(deferredInput), [deferredInput]);
  const byId = useMemo(() => new Map(tree.nodes.map((node) => [node.id, node])), [tree]);
  const [direction, setDirection] = useState<Direction>("BALANCED");
  const [mode, setMode] = useState<CountMode>("leaves");
  const [view, setView] = useState<"diagram" | "outline">("diagram");
  const [compact, setCompact] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => initialCollapsed(tree));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const actions = useRef<CanvasActions | null>(null);
  const onReady = useCallback((value: CanvasActions | null) => {
    actions.current = value;
  }, []);
  const ready = tree.nodes.length > 0 && !tree.error;
  const toggle = useCallback(
    (id: string) => {
      // Matching paths are expanded during search, regardless of saved collapse state.
      const searching = !!query.trim();
      setQuery("");
      setCollapsed((previous) => {
        const next = new Set(previous);
        if (!searching && next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [query],
  );
  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (!id) return;
      setCollapsed((previous) => {
        const next = new Set(previous);
        for (const ancestor of getAncestors(id, byId)) if (ancestor.id !== id) next.delete(ancestor.id);
        return next.size === previous.size ? previous : next;
      });
    },
    [byId],
  );
  function updateSource(value: string, focusId?: string) {
    setSelectedId(focusId ?? null);
    setNotice("");
    setCopied(false);
    const next = parseHierarchy(value);
    const structureChanged = next.nodes.length !== tree.nodes.length || next.nodes.some((entry, index) => entry.parentId !== tree.nodes[index]?.parentId);
    if (!next.error && (structureChanged || focusId)) {
      const byId = new Map(next.nodes.map((node) => [node.id, node]));
      setCollapsed((previous) => {
        const folded = structureChanged ? initialCollapsed(next) : new Set(previous);
        if (focusId) for (const ancestor of getAncestors(focusId, byId)) folded.delete(ancestor.id);
        return folded;
      });
    }
    onInputChange?.(value);
  }
  function replaceSource(value: string) {
    setCollapsed(initialCollapsed(parseHierarchy(value)));
    setQuery("");
    updateSource(value);
  }
  async function exportImage() {
    if (!actions.current || exporting) return;
    setExporting(true);
    setNotice("");
    try {
      await actions.current.exportPng();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Image export failed.");
    } finally {
      setExporting(false);
    }
  }
  async function copyJson() {
    try {
      await navigator.clipboard.writeText(hierarchyToJson(tree));
      setCopied(true);
      setNotice("Hierarchy JSON copied. Includes all entries, including collapsed branches.");
    } catch {
      setNotice("Clipboard access failed. Your JSON is also available in the Raw output view.");
    }
  }
  return (
    <div
      className="hierarchy-workspace"
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "f") {
          event.preventDefault();
          event.stopPropagation();
          searchRef.current?.focus();
        }
        if (event.key === "Escape") {
          setQuery("");
          setSelectedId(null);
        }
      }}
    >
      <TreeToolbar
        view={view}
        direction={direction}
        compact={compact}
        query={query}
        ready={ready}
        sourceOpen={sourceOpen}
        searchRef={searchRef}
        stats={ready && <TreeStats tree={tree} mode={mode} onModeChange={setMode} />}
        actions={
          <WorkspaceActions
            ready={ready}
            copied={copied}
            exporting={exporting}
            canExport={ready && view === "diagram"}
            onCopyJson={() => void copyJson()}
            onExport={() => void exportImage()}
            onImportSource={(source) => {
              replaceSource(source);
              setSourceOpen(true);
            }}
            onLoadExample={replaceSource}
            onNotice={setNotice}
          />
        }
        onToggleSource={() => setSourceOpen((value) => !value)}
        onViewChange={setView}
        onDirectionChange={setDirection}
        onQueryChange={setQuery}
        onExpandAll={() => {
          setQuery("");
          setCollapsed(new Set());
        }}
        onCollapseAll={() => {
          setQuery("");
          setSelectedId(null);
          setCollapsed(new Set(tree.nodes.filter((entry) => entry.children.length).map((entry) => entry.id)));
        }}
        onToggleCompact={() => setCompact((value) => !value)}
      />
      {notice && (
        <div className="ht-notice" role="status">
          <TreeIcon name="info" />
          <span>{notice}</span>
          <button type="button" className="ht-icon-button" aria-label="Dismiss message" onClick={() => setNotice("")}>
            <TreeIcon name="close" width={12} height={12} />
          </button>
        </div>
      )}
      <div className="ht-workbench">
        <SourcePanel
          source={input}
          visible={sourceOpen}
          selectedId={selectedId}
          onSelect={(id) => {
            setQuery("");
            select(id);
          }}
          onChange={updateSource}
          onClose={() => setSourceOpen(false)}
        />
        <main className="ht-stage">
          {ready ? (
            view === "diagram" ? (
              <TreeCanvas
                tree={tree}
                collapsed={collapsed}
                query={query}
                direction={direction}
                compact={compact}
                countMode={mode}
                selectedId={selectedId}
                theme={theme}
                onToggle={toggle}
                onSelect={select}
                onReady={onReady}
              />
            ) : (
              <HierarchyOutline tree={tree} collapsed={collapsed} query={query} mode={mode} selectedId={selectedId} onToggle={toggle} onSelect={select} />
            )
          ) : (
            <EmptyHierarchy error={tree.error} onLoadExample={replaceSource} />
          )}
        </main>
        {selectedId && byId.has(selectedId) && <NodeInspector tree={tree} selectedId={selectedId} onSelect={select} onClose={() => setSelectedId(null)} />}
      </div>
      <footer className="ht-footer">
        <span>
          <span className="ht-live-dot" />
          {input !== deferredInput
            ? "Updating…"
            : ready
              ? `${tree.format === "json" ? "JSON" : "Outline"} · ${tree.roots.length} root ${tree.roots.length === 1 ? "entry" : "entries"}`
              : "Ready for your outline"}
        </span>
        <span>Click an entry to inspect · Scroll to zoom · Drag to pan</span>
        <span>Overview excluded from counts</span>
      </footer>
    </div>
  );
}

function HierarchyTreeView(props: Parameters<typeof HierarchyWorkspace>[0]) {
  const tabId = useTabId();
  return <HierarchyWorkspace key={tabId} {...props} />;
}
registerOutputView({ id: "hierarchy-tree", name: "Tree", icon: TreeIcon, parse: (output) => output, component: HierarchyTreeView });
