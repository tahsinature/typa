import type { Hierarchy, HierarchyNode } from "./hierarchy";

export function hierarchyBulletLabel(node: HierarchyNode): string {
  const name = node.name.replace(/[\r\n]+/g, " ");
  return node.quantity === 1 ? name : `${name} :: ${node.quantity}`;
}

/** Portable Markdown and rich clipboard HTML, always including every source entry. */
export function hierarchyToBullets(tree: Hierarchy): { markdown: string; html: string } {
  if (tree.error || !tree.nodes.length) return { markdown: "", html: "" };
  const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
  const markdown = tree.nodes
    .map((node) => {
      const label = hierarchyBulletLabel(node).replace(/([\\`*_{}\[\]<>~|])/g, "\\$1");
      return `${"    ".repeat(node.depth)}- ${label}`;
    })
    .join("\n");
  const byId = new Map(tree.nodes.map((node) => [node.id, node]));
  function list(ids: string[]): string {
    return `<ul>${ids
      .map((id) => {
        const node = byId.get(id)!;
        return `<li>${escapeHtml(hierarchyBulletLabel(node))}${node.children.length ? list(node.children) : ""}</li>`;
      })
      .join("")}</ul>`;
  }
  return { markdown, html: list(tree.roots) };
}
