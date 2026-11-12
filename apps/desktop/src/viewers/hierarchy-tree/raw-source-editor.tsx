import { useRef, useState, type KeyboardEvent } from "react";

export function RawSourceEditor({ source, onChange }: { source: string; onChange: (source: string) => void }) {
  const editor = useRef<HTMLTextAreaElement>(null);
  const [scroll, setScroll] = useState(0);
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
