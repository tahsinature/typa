import { createOutlineEntry, parseHierarchy, writeOutlineEntries, type OutlineEntry } from "@typa/engine";

/** Read only list structure and visible text, never pasted attributes or markup. */
export function readBulletEntries(root: HTMLElement): OutlineEntry[] {
  return readBulletEntriesAt(root, null).entries;
}

/** Like readBulletEntries, also returning the entry index of `item` (-1 when absent). */
export function readBulletEntriesAt(root: HTMLElement, item: Element | null): { entries: OutlineEntry[]; index: number } {
  const entries: OutlineEntry[] = [];
  let index = -1;
  function label(element: HTMLElement): string {
    const clone = element.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("ul, ol, li, script, style").forEach((child) => child.remove());
    clone.querySelectorAll("br").forEach((child) => child.replaceWith("\n"));
    return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
  }
  function add(text: string, depth: number) {
    text = text.replace(/^[-*+•]\s+/, "");
    const quantity = text.match(/^(.*?)\s+::\s*(\d+(?:\.\d+)?|\.\d+)$/);
    entries.push(createOutlineEntry(depth, quantity ? quantity[1] : text, quantity ? Number(quantity[2]) : 1));
  }
  function addItem(element: HTMLElement, depth: number) {
    if (element === item) index = entries.length;
    add(label(element), depth);
    for (const child of element.children) {
      if (child.matches("ul, ol")) walk(child as HTMLElement, depth + 1);
      // WebKit's outdent can leave an li directly inside another li; it reads as a sibling.
      else if (child.tagName === "LI") addItem(child as HTMLElement, depth);
    }
  }
  function walk(container: HTMLElement, depth: number) {
    for (const child of container.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (child.textContent?.trim()) add(child.textContent.trim(), depth);
        continue;
      }
      if (!(child instanceof HTMLElement) || ["SCRIPT", "STYLE", "BR"].includes(child.tagName)) continue;
      // Chromium may indent into a list adjacent to the previous li, while
      // WebKit nests that list inside the li. Both represent the same branch.
      if (child.matches("ul, ol")) walk(child, depth + (container.matches("ul, ol") ? 1 : 0));
      else if (child.tagName === "LI") addItem(child, depth);
      else if (child.querySelector("ul, ol, li")) walk(child, depth);
      else if (label(child)) add(label(child), depth);
    }
  }
  walk(root, 0);
  return { entries, index };
}

/**
 * Inserts pasted entries as siblings after the caret item's branch, replacing the
 * caret item when it is an empty bullet without children.
 * Returns the new entries and the index of the last pasted entry.
 */
export function insertPastedEntries(entries: OutlineEntry[], index: number, pasted: OutlineEntry[]): { entries: OutlineEntry[]; last: number } {
  const anchor = entries[index];
  if (!anchor) return { entries: [...entries, ...pasted], last: entries.length + pasted.length - 1 };
  let end = index + 1;
  while (end < entries.length && entries[end].depth > anchor.depth) end++;
  const replace = !anchor.name.trim() && end === index + 1;
  const start = replace ? index : end;
  const shifted = pasted.map((entry) => ({ ...entry, depth: entry.depth + anchor.depth }));
  return { entries: [...entries.slice(0, start), ...shifted, ...entries.slice(replace ? end : start)], last: start + shifted.length - 1 };
}

/** Converts clipboard content to outline entries, or null when it should paste as plain text. */
export function readPastedBullets(html: string, text: string): { entries: OutlineEntry[] | null; error: string | null } {
  let source = text;
  if (html) {
    const body = new DOMParser().parseFromString(html, "text/html").body;
    if (body.querySelector("li")) {
      try {
        source = writeOutlineEntries(readBulletEntries(body));
      } catch (cause) {
        return { entries: null, error: cause instanceof Error ? cause.message : "Unable to paste this list." };
      }
    }
  }
  const structured = /[\r\n]/.test(text) || /^\s*(?:[-*+•]\s+|\d+[.)]\s+|[\[{])/.test(text);
  if (source === text && !structured) return { entries: null, error: null };
  const tree = parseHierarchy(source);
  if (tree.error) return { entries: null, error: tree.error };
  return { entries: tree.nodes.map((node) => createOutlineEntry(node.depth, node.name, node.quantity)), error: null };
}
