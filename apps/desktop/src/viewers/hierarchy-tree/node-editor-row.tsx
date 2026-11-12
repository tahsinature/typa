import { useEffect, useState, type ClipboardEvent, type CSSProperties, type KeyboardEvent } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { DropPlacement, OutlineEntry } from "@typa/engine";
import { TreeIcon } from "./icons";
import { formatCount } from "./model";

export interface EditorDrop {
  id: string;
  placement: DropPlacement;
}
export function dropZoneId(id: string, placement: DropPlacement) {
  return `${id}:${placement}`;
}
export function readDropZone(value: string | number): EditorDrop | null {
  const [id, placement] = String(value).split(":");
  return placement === "before" || placement === "inside" || placement === "after" ? { id, placement } : null;
}
interface Props {
  entry: OutlineEntry;
  number: number;
  color: string;
  hasChildren: boolean;
  leaves: number;
  quantity: number;
  folded: boolean;
  active: boolean;
  dragging: boolean;
  drop: EditorDrop | null;
  inputRef: (input: HTMLInputElement | null) => void;
  onActivate: () => void;
  onFold: () => void;
  onNameChange: (value: string) => void;
  onQuantityChange: (value: number) => void;
  onBlur: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLInputElement>) => void;
}
export function NodeEditorRow(props: Props) {
  const { entry, hasChildren, folded, active, color, dragging, drop } = props;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: entry.id });
  const [quantityText, setQuantityText] = useState(String(entry.quantity));
  useEffect(() => {
    setQuantityText(String(entry.quantity));
  }, [entry.quantity]);
  return (
    <div
      ref={setNodeRef}
      className={`ht-edit-row ${active ? "is-active" : ""} ${isDragging ? "is-dragging" : ""} ${hasChildren ? "is-group" : ""}`}
      style={{ "--entry-depth": entry.depth, "--branch-color": color } as CSSProperties}
    >
      <EditorDropZone id={entry.id} placement="before" dragging={dragging} active={drop?.id === entry.id && drop.placement === "before"} />
      <EditorDropZone id={entry.id} placement="inside" dragging={dragging} active={drop?.id === entry.id && drop.placement === "inside"} />
      <EditorDropZone id={entry.id} placement="after" dragging={dragging} active={drop?.id === entry.id && drop.placement === "after"} />
      <div className="ht-edit-row-content">
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="ht-drag-handle"
          {...attributes}
          {...listeners}
          tabIndex={-1}
          aria-label={`Drag ${entry.name || "untitled node"}`}
          title="Drag to move. Use Alt+↑ / Alt+↓ to reorder with the keyboard."
        >
          <TreeIcon name="grip" width={11} height={15} />
        </button>
        <div className="ht-edit-indent" aria-hidden="true">
          {Array.from({ length: entry.depth }, (_, index) => (
            <span key={index} />
          ))}
        </div>
        <button
          type="button"
          className={`ht-edit-fold ${folded ? "" : "is-open"}`}
          disabled={!hasChildren}
          tabIndex={hasChildren ? 0 : -1}
          onClick={props.onFold}
          aria-label={`${folded ? "Expand" : "Collapse"} ${entry.name || "untitled node"}`}
          aria-expanded={hasChildren ? !folded : undefined}
        >
          {hasChildren ? <TreeIcon name="chevron" width={11} height={11} /> : <span />}
        </button>
        <input
          ref={props.inputRef}
          className="ht-node-name-input"
          value={entry.name}
          aria-label={`Node name, row ${props.number}: ${entry.name || "untitled"}`}
          placeholder="Name this node…"
          onFocus={props.onActivate}
          onChange={(event) => props.onNameChange(event.target.value)}
          onBlur={props.onBlur}
          onKeyDown={props.onKeyDown}
          onPaste={props.onPaste}
          autoComplete="off"
        />
        {hasChildren ? (
          <span className="ht-editor-leaf-count" title={`${formatCount(props.leaves)} nested ${props.leaves === 1 ? "leaf" : "leaves"} · quantity ${formatCount(props.quantity)}`}>
            {formatCount(props.leaves)}
          </span>
        ) : (
          <input
            type="number"
            className={`ht-node-quantity-input ${entry.quantity === 1 ? "is-default" : ""}`}
            min="0"
            step="any"
            value={quantityText}
            aria-label={`Quantity for ${entry.name || "untitled node"}`}
            title="Leaf quantity"
            onFocus={props.onActivate}
            onChange={(event) => {
              const value = event.target.value;
              setQuantityText(value);
              if (value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0) props.onQuantityChange(Number(value));
            }}
            onBlur={() => {
              setQuantityText(String(entry.quantity));
              props.onBlur();
            }}
          />
        )}
      </div>
      {drop?.id === entry.id && (
        <span className={`ht-drop-label is-${drop.placement}`}>
          {drop.placement === "inside" ? "Nest inside" : drop.placement === "before" ? "Move before" : "Move after"} {entry.name || "Untitled"}
        </span>
      )}
    </div>
  );
}
function EditorDropZone({ id, placement, dragging, active }: { id: string; placement: DropPlacement; dragging: boolean; active: boolean }) {
  const { setNodeRef } = useDroppable({ id: dropZoneId(id, placement) });
  return <div ref={setNodeRef} className={`ht-editor-dropzone is-${placement} ${dragging ? "is-enabled" : ""} ${active ? "is-target" : ""}`} />;
}
