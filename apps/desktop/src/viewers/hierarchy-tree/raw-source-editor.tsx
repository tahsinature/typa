import { getNodeSourceRange, type NodeEditRequest } from "./source-navigation";
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

export function RawSourceEditor({ source, onChange, editRequest }: { editRequest: NodeEditRequest | null; source: string; onChange: (source: string) => void }) {
  const editor = useRef<HTMLTextAreaElement>(null);
  const [scroll, setScroll] = useState(0);
  useLayoutEffect(() => {
    if (!editRequest || editRequest.source !== source || !editor.current) return;
    const textarea = editor.current;
    // Textareas normalize CRLF to LF, so use the displayed value for offsets.
    const text = textarea.value;
    const range = getNodeSourceRange(text, editRequest.id);
    if (!range) return;
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(range.start, range.end);
    const before = text.slice(0, range.start);
    const line = before.split("\n").length - 1;
    const style = getComputedStyle(textarea);
    const lineHeight = parseFloat(style.lineHeight) || 20;
    textarea.scrollTop = Math.max(0, line * lineHeight - textarea.clientHeight / 2);
    const measure = document.createElement("canvas").getContext("2d");
    if (measure) {
      measure.font = style.font;
      const prefix = before.slice(before.lastIndexOf("\n") + 1).replace(/\t/g, "    ");
      textarea.scrollLeft = Math.max(0, measure.measureText(prefix).width - textarea.clientWidth / 3);
    }
  }, [editRequest]);

  function indent(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") event.currentTarget.blur();
    if (event.key !== "Tab") return;
    event.preventDefault();
    const { selectionStart: start, selectionEnd: end } = event.currentTarget;
    const lineStart = start === 0 ? 0 : source.lastIndexOf("\n", start - 1) + 1;
    const selection = source.slice(lineStart, end);
    if (event.shiftKey) {
      const lines = selection.split("\n");
      const removedFirst = lines[0].match(/^(?: {1,2}|\t)/)?.[0].length ?? 0;
      const updated = lines.map((line) => line.replace(/^(?: {1,2}|\t)/, "")).join("\n");
      onChange(source.slice(0, lineStart) + updated + source.slice(end));
      requestAnimationFrame(() => editor.current?.setSelectionRange(Math.max(lineStart, start - removedFirst), end - (selection.length - updated.length)));
    } else if (start !== end) {
      const updated = selection.replace(/^/gm, "  ");
      onChange(source.slice(0, lineStart) + updated + source.slice(end));
      requestAnimationFrame(() => editor.current?.setSelectionRange(start + 2, end + updated.length - selection.length));
    } else {
      onChange(source.slice(0, start) + "  " + source.slice(end));
      requestAnimationFrame(() => editor.current?.setSelectionRange(start + 2, start + 2));
    }
  }
  return (
    <div className="ht-editor">
      <div className="ht-line-gutter" aria-hidden="true">
        <div style={{ transform: `translateY(-${scroll}px)` }}>
          {Array.from({ length: source.split("\n").length }, (_, index) => (
            <div key={index}>{index + 1}</div>
          ))}
        </div>
      </div>
      <textarea
        ref={editor}
        aria-label="Hierarchy outline or JSON"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        value={source}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={indent}
        onScroll={(event) => setScroll(event.currentTarget.scrollTop)}
        placeholder={"My project\n  Design\n    Research\n    Prototype\n  Build\n    Frontend\n    Backend"}
      />
    </div>
  );
}
