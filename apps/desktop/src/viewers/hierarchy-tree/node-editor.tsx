import { useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useSensor, useSensors } from "@dnd-kit/core";
import {
  indentOutlineBranch,
  outdentOutlineBranch,
  shiftOutlineBranch,
  insertOutlineEntry,
  removeOutlineBranch,
  pasteOutlineEntries,
  moveOutlineBranch,
  outlineParent,
  outlineBranchEnd,
  parseHierarchy,
  type OutlineEntry,
} from "@typa/engine";
import { TreeIcon, type TreeIconName } from "./icons";
import { hierarchyColors } from "./model";
import { NodeEditorRow, readDropZone, type EditorDrop } from "./node-editor-row";
import type { OutlineDocument } from "./use-outline-document";

export function NodeEditor({ editor, selectedId, onSelect }: { editor: OutlineDocument; selectedId: string | null; onSelect: (id: string) => void }) {
  const { entries, focusId } = editor.document;
  const tree = useMemo(() => parseHierarchy(editor.document.source), [editor.document.source]);
  const colors = useMemo(() => hierarchyColors(tree), [tree]);
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [drop, setDrop] = useState<EditorDrop | null>(null);
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const sensors = useSensors(useSensor(PointerSensor));
  const selectedIndex = selectedId?.startsWith("entry-") ? Number(selectedId.slice(6)) : -1;
  const active = entries[selectedIndex] ?? entries.find((entry) => entry.id === focusId);
  const dragged = entries.find((entry) => entry.id === draggingId);
  useLayoutEffect(() => {
    const input = editor.focusRequest.id ? inputs.current.get(editor.focusRequest.id) : null;
    if (!input) return;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    input.scrollIntoView({ block: "nearest" });
  }, [editor.focusRequest]);
  useLayoutEffect(() => {
    if (!pendingFocus) return;
    focusRow(pendingFocus);
    setPendingFocus(null);
  }, [pendingFocus]);

  function reveal(next: OutlineEntry[], id: string | null) {
    setFolded((previous) => {
      const unfolded = new Set(previous);
      let index = next.findIndex((entry) => entry.id === id);
      while (index >= 0) {
        index = outlineParent(next, index);
        if (index >= 0) unfolded.delete(next[index].id);
      }
      return unfolded;
    });
  }
  function changeBranch(next: OutlineEntry[] | null, id: string | null) {
    if (!next) return;
    reveal(next, id);
    editor.commit(next, id, { focus: true });
  }
  function add(id: string | null, child = false) {
    const next = insertOutlineEntry(entries, id, child);
    changeBranch(next.entries, next.focusId);
  }
  function remove(id: string) {
    const next = removeOutlineBranch(entries, id);
    changeBranch(next.entries, next.focusId);
  }
  function toggleFold(id: string) {
    setFolded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  /** Unfold any collapsed ancestors, then focus the row once it renders. */
  function revealAndFocus(id: string) {
    reveal(entries, id);
    setPendingFocus(id);
  }
  function focusParent(index: number) {
    const parent = outlineParent(entries, index);
    if (parent >= 0) revealAndFocus(entries[parent].id);
  }
  function focusRow(id: string) {
    const input = inputs.current.get(id);
    input?.focus();
    input?.scrollIntoView({ block: "nearest" });
  }
  const numbers: number[] = [];
  const rows: { entry: OutlineEntry; index: number; number: number }[] = [];
  let hiddenDepth: number | null = null;
  entries.forEach((entry, index) => {
    numbers.length = entry.depth + 1;
    numbers[entry.depth] = (numbers[entry.depth] ?? 0) + 1;
    if (hiddenDepth !== null && entry.depth > hiddenDepth) return;
    hiddenDepth = null;
    rows.push({ entry, index, number: numbers[entry.depth] });
    if (folded.has(entry.id)) hiddenDepth = entry.depth;
  });
  function keyDown(event: KeyboardEvent<HTMLInputElement>, entry: OutlineEntry) {
    if (event.nativeEvent.isComposing) return;
    const index = entries.findIndex((item) => item.id === entry.id);
    const mod = event.metaKey || event.ctrlKey;
    if (event.altKey && event.key === "ArrowLeft") {
      event.preventDefault();
      focusParent(index);
    } else if (event.altKey && event.key === "ArrowRight") {
      event.preventDefault();
      const child = entries[index + 1];
      if (child && child.depth > entry.depth) revealAndFocus(child.id);
    } else if (mod && event.key === ".") {
      event.preventDefault();
      if (tree.nodes[index]?.children.length) toggleFold(entry.id);
    } else if (mod && event.shiftKey && event.key === "Backspace") {
      event.preventDefault();
      remove(entry.id);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (!entry.name.trim() && entry.depth > 0 && !event.shiftKey) changeBranch(outdentOutlineBranch(entries, entry.id), entry.id);
      else if (entry.name.trim() || event.shiftKey) add(entry.id, event.shiftKey);
    } else if (event.key === "Tab") {
      event.preventDefault();
      changeBranch(event.shiftKey ? outdentOutlineBranch(entries, entry.id) : indentOutlineBranch(entries, entry.id), entry.id);
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      if (event.altKey) changeBranch(shiftOutlineBranch(entries, entry.id, event.key === "ArrowUp" ? -1 : 1), entry.id);
      else {
        const index = rows.findIndex((row) => row.entry.id === entry.id);
        const next = rows[index + (event.key === "ArrowUp" ? -1 : 1)];
        if (next) focusRow(next.entry.id);
      }
    } else if (event.key === "Backspace" && !entry.name && !mod) {
      if (outlineBranchEnd(entries, index) === index + 1) {
        event.preventDefault();
        remove(entry.id);
      }
    } else if (event.key === "Escape") event.currentTarget.blur();
  }
  function paste(event: ClipboardEvent<HTMLInputElement>, entry: OutlineEntry) {
    const text = event.clipboardData.getData("text/plain");
    if (!text.includes("\n") && !/^\s*[\[{]/.test(text)) return;
    event.preventDefault();
    const pasted = pasteOutlineEntries(entries, entry.id, text);
    if (!pasted) {
      editor.setError(parseHierarchy(text).error ?? "No nodes found in the pasted text.");
      return;
    }
    changeBranch(pasted.entries, pasted.focusId);
  }
  return (
    <div className="ht-node-editor">
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={({ active }) => {
          editor.breakEditGroup();
          setDraggingId(String(active.id));
        }}
        onDragOver={({ active, over }) => {
          const target = over ? readDropZone(over.id) : null;
          setDrop(target && moveOutlineBranch(entries, String(active.id), target.id, target.placement) ? target : null);
        }}
        onDragCancel={() => {
          setDraggingId(null);
          setDrop(null);
        }}
        onDragEnd={({ active, over }) => {
          const target = over ? readDropZone(over.id) : null;
          if (target) changeBranch(moveOutlineBranch(entries, String(active.id), target.id, target.placement), String(active.id));
          setDraggingId(null);
          setDrop(null);
        }}
      >
        <div className={`ht-node-editor-list ${draggingId ? "is-dragging" : ""}`} aria-label="Editable hierarchy nodes">
          {!entries.length && (
            <div className="ht-node-editor-empty">
              <TreeIcon name="tree" width={27} height={27} />
              <strong>Your first node starts here.</strong>
              <span>Add a node, paste an outline, or load an example.</span>
            </div>
          )}
          {rows.map(({ entry, index, number }) => (
            <NodeEditorRow
              key={entry.id}
              entry={entry}
              number={number}
              color={colors.get(`entry-${index}`) ?? "var(--cl-accent)"}
              hasChildren={tree.nodes[index]?.children.length > 0}
              leaves={tree.nodes[index]?.leafCount ?? 1}
              quantity={tree.nodes[index]?.quantityTotal ?? entry.quantity}
              folded={folded.has(entry.id)}
              active={selectedId === `entry-${index}` || (!selectedId && focusId === entry.id)}
              dragging={!!draggingId}
              drop={drop}
              inputRef={(input) => {
                if (input) inputs.current.set(entry.id, input);
                else inputs.current.delete(entry.id);
              }}
              onActivate={() => {
                editor.activate(entry.id);
                onSelect(`entry-${index}`);
              }}
              onFold={() => toggleFold(entry.id)}
              onNameChange={(value) =>
                editor.commit(
                  entries.map((item) => (item.id === entry.id ? { ...item, name: value } : item)),
                  entry.id,
                  { group: `name:${entry.id}` },
                )
              }
              onQuantityChange={(value) =>
                editor.commit(
                  entries.map((item) => (item.id === entry.id ? { ...item, quantity: value } : item)),
                  entry.id,
                  { group: `quantity:${entry.id}` },
                )
              }
              onBlur={editor.breakEditGroup}
              onKeyDown={(event) => keyDown(event, entry)}
              onPaste={(event) => paste(event, entry)}
            />
          ))}
          <button type="button" className="ht-add-node" onClick={() => add(null)}>
            <TreeIcon name="plus" width={14} height={14} />
            Add node
          </button>
        </div>
        <DragOverlay dropAnimation={null}>
          {dragged && (
            <div className="ht-node-drag-overlay">
              <TreeIcon name="tree" />
              <span>{dragged.name || "Untitled"}</span>
              <small>Whole branch</small>
            </div>
          )}
        </DragOverlay>
      </DndContext>
      {active && (
        <div className="ht-node-actions" aria-label={`Actions for ${active.name || "untitled node"}`}>
          <button type="button" className="ht-add-child" title="Add child (⇧Enter)" onClick={() => add(active.id, true)}>
            <TreeIcon name="plus" width={12} height={12} />
            Add child
          </button>
          <Action icon="parent" label="Go to parent (⌥←)" disabled={active.depth === 0} onClick={() => focusParent(entries.findIndex((entry) => entry.id === active.id))} />
          <Action
            icon="indent"
            label="Indent node (Tab)"
            disabled={!indentOutlineBranch(entries, active.id)}
            onClick={() => changeBranch(indentOutlineBranch(entries, active.id), active.id)}
          />
          <Action
            icon="outdent"
            label="Outdent node (⇧Tab)"
            disabled={!outdentOutlineBranch(entries, active.id)}
            onClick={() => changeBranch(outdentOutlineBranch(entries, active.id), active.id)}
          />
          <Action
            icon="up"
            label="Move branch up (⌥↑)"
            disabled={!shiftOutlineBranch(entries, active.id, -1)}
            onClick={() => changeBranch(shiftOutlineBranch(entries, active.id, -1), active.id)}
          />
          <Action
            icon="chevron"
            label="Move branch down (⌥↓)"
            className="ht-move-down"
            disabled={!shiftOutlineBranch(entries, active.id, 1)}
            onClick={() => changeBranch(shiftOutlineBranch(entries, active.id, 1), active.id)}
          />
          <Action icon="trash" label="Delete branch (⌘⇧⌫, undo available)" className="ht-delete-node" onClick={() => remove(active.id)} />
        </div>
      )}
      <div className="ht-editor-announcement" role="status" aria-live="polite">
        {drop ? `${drop.placement === "inside" ? "Nest inside" : `Move ${drop.placement}`} ${entries.find((entry) => entry.id === drop.id)?.name || "Untitled"}` : ""}
      </div>
    </div>
  );
}
function Action({ icon, label, className = "", ...props }: { icon: TreeIconName; label: string; className?: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`ht-icon-button ${className}`} title={label} aria-label={label} {...props}>
      <TreeIcon name={icon} width={14} height={14} />
    </button>
  );
}
