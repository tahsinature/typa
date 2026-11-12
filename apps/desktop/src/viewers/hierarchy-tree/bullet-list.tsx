import { useLayoutEffect, useRef, type KeyboardEvent } from "react";
import { hierarchyToBullets, writeOutlineEntries, type Hierarchy } from "@typa/engine";
import type { OutlineDocument } from "./use-outline-document";
import { readBulletEntries, readPastedBullets } from "./bullet-editor-dom";

export function BulletList({ tree, editor }: { tree: Hierarchy; editor: OutlineDocument }) {
  const element = useRef<HTMLDivElement>(null);
  const lastSource = useRef<string | null>(null);
  const composing = useRef(false);

  // The browser owns the editing DOM while typing, preserving its caret and selection.
  useLayoutEffect(() => {
    const root = element.current;
    if (!root || lastSource.current === editor.document.source) return;
    const focused = root.contains(window.getSelection()?.anchorNode ?? null);
    root.innerHTML = hierarchyToBullets(tree).html || "<ul><li><br></li></ul>";
    lastSource.current = editor.document.source;
    if (focused) {
      const range = document.createRange();
      range.selectNodeContents(root);
      range.collapse(false);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }
  }, [tree, editor.document.source]);

  function publish() {
    if (!element.current || composing.current) return;
    try {
      const entries = readBulletEntries(element.current);
      const source = writeOutlineEntries(entries);
      if (source === lastSource.current) return;
      if (editor.commit(entries, null, { group: "bullets" })) lastSource.current = source;
    } catch (cause) {
      editor.setError(cause instanceof Error ? cause.message : "Unable to edit this list.");
    }
  }
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.nativeEvent.isComposing) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      event.stopPropagation();
      const range = document.createRange();
      range.selectNodeContents(event.currentTarget);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    } else if (event.key === "Tab") {
      event.preventDefault();
      editor.breakEditGroup();
      document.execCommand(event.shiftKey ? "outdent" : "indent");
      publish();
      editor.breakEditGroup();
    } else if (event.key === "Enter") {
      editor.breakEditGroup();
      if (event.shiftKey) {
        event.preventDefault();
        document.execCommand("insertParagraph");
        document.execCommand("indent");
        publish();
      }
    } else if (event.key === "Escape") {
      event.currentTarget.blur();
      event.stopPropagation();
    } else if ((event.metaKey || event.ctrlKey) && ["b", "i", "u"].includes(event.key.toLowerCase())) {
      event.preventDefault();
    }
  }
  return (
    <section className="ht-bullet-list" aria-label="Bullet list editor">
      <p className="ht-bullet-hint">Enter adds a bullet. Tab nests; Shift+Tab moves out. Select and copy any part of your list.</p>
      {tree.error ? (
        <p className="ht-source-error">Fix the raw source to edit the bullet list: {tree.error}</p>
      ) : (
        <div
          ref={element}
          className="ht-bullet-preview ht-bullet-editor"
          role="textbox"
          aria-label="Editable bullet list"
          aria-multiline="true"
          contentEditable
          suppressContentEditableWarning
          spellCheck
          onInput={publish}
          onKeyDown={keyDown}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={() => {
            composing.current = false;
            publish();
          }}
          onBlur={editor.breakEditGroup}
          onPaste={(event) => {
            event.preventDefault();
            const text = event.clipboardData.getData("text/plain");
            const html = event.clipboardData.getData("text/html");
            editor.breakEditGroup();
            const pasted = readPastedBullets(html, text);
            if (pasted.error) {
              editor.setError(pasted.error);
              return;
            }
            if (pasted.html) document.execCommand("insertHTML", false, pasted.html);
            else document.execCommand("insertText", false, text);
            publish();
            editor.breakEditGroup();
          }}
          onDrop={(event) => event.preventDefault()}
          onBeforeInput={(event) => {
            if ((event.nativeEvent as InputEvent).inputType === "insertText") {
              const parent = window.getSelection()?.anchorNode?.parentElement;
              if (parent && element.current?.contains(parent) && !parent.closest("li")) document.execCommand("insertUnorderedList");
            }
          }}
        />
      )}
    </section>
  );
}
