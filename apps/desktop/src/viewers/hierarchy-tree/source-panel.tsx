import { useMemo, useState } from "react";
import { parseHierarchy } from "@typa/engine";
import { TreeIcon } from "./icons";
import { NodeEditor } from "./node-editor";
import { RawSourceEditor } from "./raw-source-editor";
import { useOutlineDocument } from "./use-outline-document";
import { BulletList } from "./bullet-list";
import { EditorHelp } from "./editor-help";
import type { TreeIconName } from "./icons";

type EditorView = "nodes" | "source" | "bullets";
const modes: { value: EditorView; icon: TreeIconName; label: string; title: string }[] = [
  { value: "nodes", icon: "tree", label: "Nodes", title: "Edit nodes with the keyboard" },
  { value: "bullets", icon: "list", label: "Bullets", title: "Editable bullet list for copy and paste" },
  { value: "source", icon: "source", label: "Raw", title: "Raw outline or JSON source" },
];

interface Props {
  source: string;
  visible: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (source: string, focusId?: string) => void;
  onClose: () => void;
}
export function SourcePanel({ source, visible, selectedId, onSelect, onChange, onClose }: Props) {
  const [view, setView] = useState<EditorView>("nodes");
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
        <div className="ht-segment" aria-label="Editing mode">
          {modes.map((mode) => (
            <button key={mode.value} type="button" aria-pressed={view === mode.value} onClick={() => setView(mode.value)} title={mode.title}>
              <TreeIcon name={mode.icon} />
              {mode.label}
            </button>
          ))}
        </div>
        <div className="ht-editor-history">
          <button type="button" className="ht-icon-button" onClick={editor.undo} disabled={!editor.canUndo} aria-label="Undo outline edit" title="Undo (⌘Z / Ctrl+Z)">
            <TreeIcon name="undo" width={14} height={14} />
          </button>
          <button type="button" className="ht-icon-button" onClick={editor.redo} disabled={!editor.canRedo} aria-label="Redo outline edit" title="Redo (⌘⇧Z / Ctrl+Shift+Z)">
            <TreeIcon name="redo" width={14} height={14} />
          </button>
          <EditorHelp />
          <button type="button" className="ht-icon-button" onClick={onClose} aria-label="Hide editor panel" title="Hide editor panel">
            <TreeIcon name="close" />
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
    </aside>
  );
}
