import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from "react";
import { hierarchyToBullets, writeOutlineEntries, type Hierarchy, type OutlineEntry } from "@typa/engine";
import type { OutlineDocument } from "./use-outline-document";
import { insertPastedEntries, readBulletEntries, readBulletEntriesAt, readPastedBullets } from "./bullet-editor-dom";

const BULLET_MARKERS = new Set(["-", "*", "+", "•"]);
/** The item's own text, without nested lists. */
function itemText(item: HTMLElement) {
  const clone = item.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("ul, ol").forEach((list) => list.remove());
  return (clone.textContent ?? "").trim();
}

export function BulletList({ tree, editor }: { tree: Hierarchy; editor: OutlineDocument }) {
  const element = useRef<HTMLDivElement>(null);
  const lastSource = useRef<string | null>(null);
  const composing = useRef(false);
  /** Item index to place the caret at after the next render, set by paste. */
  const caretIndex = useRef<number | null>(null);

  // The browser owns the editing DOM while typing, preserving its caret and selection.
  useLayoutEffect(() => {
    const root = element.current;
    if (!root || lastSource.current === editor.document.source) return;
    const focused = root.contains(window.getSelection()?.anchorNode ?? null);
    render();
    const caretItem = caretIndex.current === null ? null : root.querySelectorAll("li")[caretIndex.current];
    caretIndex.current = null;
    if (focused) {
      const range = document.createRange();
      // Place the caret after the item's own text, before any nested list.
      if (caretItem) range.setStart(caretItem, caretItem.firstChild?.nodeType === Node.TEXT_NODE ? 1 : 0);
      else range.selectNodeContents(root);
      range.collapse(false);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }
  }, [tree, editor.document.source]);

  function render() {
    const root = element.current;
    if (!root) return;
    root.innerHTML = hierarchyToBullets(tree).html || "<ul><li><br></li></ul>";
    lastSource.current = editor.document.source;
  }
  function currentItem() {
    const node = window.getSelection()?.anchorNode ?? null;
    const target = node instanceof Element ? node : node?.parentElement;
    const item = target?.closest("li");
    return item && element.current?.contains(item) ? item : null;
  }
  function ensureListItem() {
    if (!currentItem()) document.execCommand("insertUnorderedList");
  }
  // WebKit's highlight skips the first bullet, so a full selection gets one uniform highlight instead.
  useEffect(() => {
    const compact = (text: string) => text.replace(/\s+/g, "");
    function selectionChange() {
      const root = element.current;
      const selection = window.getSelection();
      if (!root) return;
      const text = compact(root.textContent ?? "");
      const all = !!text && !!selection && root.contains(selection.anchorNode) && compact(selection.toString()) === text;
      root.classList.toggle("is-all-selected", all);
    }
    document.addEventListener("selectionchange", selectionChange);
    return () => document.removeEventListener("selectionchange", selectionChange);
  }, []);
  // React's onBeforeInput is a polyfill without inputType, so listen to the native event.
  useEffect(() => {
    const root = element.current;
    if (!root) return;
    function beforeInput(event: InputEvent) {
      if (event.inputType !== "insertText") return;
      if (!currentItem()) {
        // Turning the line into a bullet cancels the pending keystroke in WebKit, so insert it ourselves.
        event.preventDefault();
        document.execCommand("insertUnorderedList");
        document.execCommand("insertText", false, event.data ?? "");
        return;
      }
      // Typing a bullet marker such as "- " at the start of a line is redundant, so drop it.
      const item = currentItem();
      if (event.data === " " && item && BULLET_MARKERS.has(itemText(item))) {
        event.preventDefault();
        document.execCommand("delete");
      }
    }
    root.addEventListener("beforeinput", beforeInput);
    return () => root.removeEventListener("beforeinput", beforeInput);
  });
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
  // Splicing entries keeps pasted lists well-formed, unlike inserting HTML at the caret.
  function pasteEntries(pasted: OutlineEntry[]) {
    const root = element.current;
    if (!root) return;
    if (!window.getSelection()?.isCollapsed) document.execCommand("delete");
    const { entries, index } = readBulletEntriesAt(root, currentItem());
    const next = insertPastedEntries(entries, index, pasted);
    try {
      if (editor.commit(next.entries, null, { group: "bullets" })) caretIndex.current = next.last;
    } catch (cause) {
      editor.setError(cause instanceof Error ? cause.message : "Unable to paste this list.");
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
      ensureListItem();
      document.execCommand(event.shiftKey ? "outdent" : "indent");
      publish();
      editor.breakEditGroup();
    } else if (event.key === "Enter") {
      editor.breakEditGroup();
      const item = currentItem();
      if (!event.shiftKey && item && !itemText(item)) {
        // An empty bullet moves out one level instead of leaving the list.
        event.preventDefault();
        if (item.parentElement?.parentElement !== element.current) {
          document.execCommand("outdent");
          publish();
        }
      } else if (event.shiftKey) {
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
          onBlur={() => {
            editor.breakEditGroup();
            render();
          }}
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
            if (pasted.entries) pasteEntries(pasted.entries);
            else {
              document.execCommand("insertText", false, text);
              publish();
            }
            editor.breakEditGroup();
          }}
          onDrop={(event) => event.preventDefault()}
        />
      )}
    </section>
  );
}
