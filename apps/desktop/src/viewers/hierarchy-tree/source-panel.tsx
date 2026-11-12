import { useMemo, useState } from "react";
import { parseHierarchy } from "@typa/engine";
import { TreeIcon } from "./icons";
import { NodeEditor } from "./node-editor";
import { RawSourceEditor } from "./raw-source-editor";
import { useOutlineDocument } from "./use-outline-document";
import { BulletList } from "./bullet-list";

interface Props {
  source: string;
  visible: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (source: string, focusId?: string) => void;
  onClose: () => void;
}
export function SourcePanel({ source, visible, selectedId, onSelect, onChange, onClose }: Props) {
  const [view, setView] = useState<"nodes" | "source" | "bullets">("nodes");
  const editor = useOutlineDocument(source, onChange);
  const tree = useMemo(() => parseHierarchy(editor.document.source), [editor.document.source]);
  return (
    <aside
      className="ht-source ht-outline-editor-panel"
      aria-label="Hierarchy editor"
      hidden={!visible}
      onKeyDownCapture={(event) => {
        if (event.nativeEvent.isComposing || !(event.metaKey || event.ctrlKey)) return;
        const key = event.key.toLowerCase();
        if (key !== "z" && key !== "y") return;
        event.preventDefault();
        event.stopPropagation();
        if (key === "y" || event.shiftKey) editor.redo();
        else editor.undo();
      }}
    >
      <div className="ht-panel-heading">
        <span>
          <TreeIcon name="list" /> My outline
        </span>
        <div className="ht-editor-history">
          <button type="button" className="ht-icon-button" onClick={editor.undo} disabled={!editor.canUndo} aria-label="Undo outline edit" title="Undo (⌘Z / Ctrl+Z)">
            <TreeIcon name="undo" width={14} height={14} />
          </button>
          <button type="button" className="ht-icon-button" onClick={editor.redo} disabled={!editor.canRedo} aria-label="Redo outline edit" title="Redo (⌘⇧Z / Ctrl+Shift+Z)">
            <TreeIcon name="redo" width={14} height={14} />
          </button>
          <span />
          <button type="button" className="ht-icon-button" onClick={onClose} aria-label="Hide editor panel">
            <TreeIcon name="close" />
          </button>
        </div>
      </div>
      <div className="ht-editor-mode">
        <div className="ht-segment" aria-label="Editing mode">
          <button
            type="button"
            aria-pressed={view === "nodes"}
            onClick={() => {
              setView("nodes");
            }}
          >
            <TreeIcon name="list" />
            Nodes
          </button>
          <button
            type="button"
            aria-pressed={view === "bullets"}
            onClick={() => {
              setView("bullets");
            }}
          >
            Bullet list
          </button>
          <button
            type="button"
            aria-pressed={view === "source"}
            onClick={() => {
              setView("source");
            }}
          >
            <TreeIcon name="source" />
            Raw source
          </button>
        </div>
      </div>
      {view === "bullets" ? (
        <BulletList tree={tree} editor={editor} />
      ) : view === "nodes" ? (
        tree.error ? (
          <div className="ht-node-editor-error">
            <TreeIcon name="info" />
            <p>{tree.error}</p>
            <button type="button" className="ht-button" onClick={() => setView("source")}>
              Edit raw source
            </button>
          </div>
        ) : (
          <NodeEditor editor={editor} selectedId={selectedId} onSelect={onSelect} />
        )
      ) : (
        <>
          <div className="ht-editor-heading">
            <span>{tree.format === "json" ? "JSON" : "OUTLINE"}</span>
            <span>{editor.document.source.split(/\r?\n/).length} lines</span>
          </div>
          <RawSourceEditor source={editor.document.source} onChange={editor.editSource} />
        </>
      )}
      {editor.error && (
        <div className="ht-source-error" role="alert">
          {editor.error}
        </div>
      )}
      <details className="ht-source-help">
        <summary>Editor & counting guide</summary>
        <div>
          <p>Enter adds a sibling. Shift+Enter adds a child. Tab nests under the previous sibling; Shift+Tab moves a branch out. Arrow keys move between rows.</p>
          <p>Drag the grip to move a branch before, after, or inside another node. Alt+↑ / Alt+↓ reorder siblings. Moves include every descendant.</p>
          <p>Use the quantity field for leaf totals. Group badges show leaves; group quantities are calculated automatically. Blank nodes appear as “Untitled” in the diagram.</p>
          <p>Paste an indented list or JSON into a node to import a branch. The raw source view accepts bullets, numbered lists, and JSON with name and children fields.</p>
          <p>
            The bullet list is editable. Select any text to copy formatted bullets, or select all within the editor to replace the list by pasting. Changes sync across all views.
          </p>
          <p>
            Undo and redo include typing, quantity edits, and branch moves. Duplicate names stay separate. Up to 5,000 entries and 64 levels. Escape releases the editor’s keyboard
            focus.
          </p>
        </div>
      </details>
      <div className="ht-source-footer">
        <span className="ht-live-dot" /> All data stays on your device
      </div>
    </aside>
  );
}
