import { createOutlineEntry, hierarchyToBullets, parseHierarchy, writeOutlineEntries, type OutlineEntry } from "@typa/engine";

/** Read only list structure and visible text, never pasted attributes or markup. */
export function readBulletEntries(root: HTMLElement): OutlineEntry[] {
  const entries: OutlineEntry[] = [];
  function label(element: HTMLElement): string {
    const clone = element.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("ul, ol, script, style").forEach((child) => child.remove());
    clone.querySelectorAll("br").forEach((child) => child.replaceWith("\n"));
    return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
  }
  function add(text: string, depth: number) {
    const quantity = text.match(/^(.*?)\s+::\s*(\d+(?:\.\d+)?|\.\d+)$/);
    entries.push(createOutlineEntry(depth, quantity ? quantity[1] : text, quantity ? Number(quantity[2]) : 1));
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
      else if (child.tagName === "LI") {
        add(label(child), depth);
        child.querySelectorAll<HTMLElement>(":scope > ul, :scope > ol").forEach((list) => walk(list, depth + 1));
      } else if (child.querySelector("ul, ol, li")) walk(child, depth);
      else if (label(child)) add(label(child), depth);
    }
  }
  walk(root, 0);
  return entries;
}

export function readPastedBullets(html: string, text: string): { html: string; error: string | null } {
  let source = text;
  if (html) {
    const body = new DOMParser().parseFromString(html, "text/html").body;
    if (body.querySelector("li")) {
      try {
        source = writeOutlineEntries(readBulletEntries(body));
      } catch (cause) {
        return { html: "", error: cause instanceof Error ? cause.message : "Unable to paste this list." };
      }
    }
  }
  const structured = /[\r\n]/.test(text) || /^\s*(?:[-*+•]\s+|\d+[.)]\s+|[\[{])/.test(text);
  if (source === text && !structured) return { html: "", error: null };
  const tree = parseHierarchy(source);
  return { html: hierarchyToBullets(tree).html, error: tree.error };
}
