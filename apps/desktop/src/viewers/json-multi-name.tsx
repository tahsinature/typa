import { useEffect, useRef, useState } from "react";

/**
 * The node name shown in a card header. When `editable`, it becomes a
 * click-to-edit field (Enter commits, Esc cancels, empty clears). Names that
 * came from a comment line are shown but not editable inline — the comment
 * always wins, so editing a field there would have no visible effect.
 */
export function NameEditor({
  name,
  nameSource,
  editable,
  onRename,
}: {
  name?: string;
  nameSource?: "comment" | "field";
  editable: boolean;
  onRename: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  // Enter/Escape commit or cancel and then blur; this flag stops the resulting
  // blur from committing a second (possibly stale) time.
  const skipBlur = useRef(false);

  // Focus + select on entering edit mode. This is more reliable than `autoFocus`
  // inside a virtualized row, where the input can mount without taking focus —
  // leaving no blur to fire (and so no save) when you click away.
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const start = () => {
    setDraft(name ?? "");
    setEditing(true);
  };

  const finish = (save: boolean) => {
    setEditing(false);
    if (!save) return;
    const next = draft.trim();
    if (next !== (name ?? "")) onRename(next);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        placeholder="Name…"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); skipBlur.current = true; finish(true); }
          else if (e.key === "Escape") { e.preventDefault(); skipBlur.current = true; finish(false); }
        }}
        onBlur={() => {
          if (skipBlur.current) { skipBlur.current = false; return; }
          finish(true);
        }}
        // No border / no vertical padding: the input shares the text's exact
        // line box so activating it never changes the row height. A subtle
        // background (not a focus border) signals it's editable.
        className="text-[13px] font-medium text-text bg-bg-hover/60 rounded-[3px] px-1 py-0 min-w-0 max-w-[240px] outline-none border-0"
      />
    );
  }

  // A comment-line name wins over any field, so it can't be edited inline.
  if (name && nameSource === "comment") {
    return (
      <span
        className="text-[13px] font-medium text-text truncate min-w-0"
        title="Named via a comment line above — edit the input to rename"
      >
        {name}
      </span>
    );
  }

  if (!editable) {
    return name ? (
      <span className="text-[13px] font-medium text-text truncate min-w-0" title={name}>
        {name}
      </span>
    ) : null;
  }

  if (name) {
    return (
      <button
        type="button"
        title="Click to rename"
        onClick={(e) => { e.stopPropagation(); start(); }}
        className="text-[13px] font-medium text-text truncate min-w-0 text-left hover:underline decoration-dotted underline-offset-2 cursor-text"
      >
        {name}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); start(); }}
      className="text-[12px] text-text-faint hover:text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-text"
    >
      + Name
    </button>
  );
}
