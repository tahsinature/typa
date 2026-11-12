export interface HierarchyNode {
  id: string;
  name: string;
  parentId: string | null;
  children: string[];
  depth: number;
  branch: number;
  line: number | null;
  quantity: number;
  leafCount: number;
  nodeCount: number;
  quantityTotal: number;
}

export interface Hierarchy {
  nodes: HierarchyNode[];
  roots: string[];
  leaves: number;
  groups: number;
  quantity: number;
  depth: number;
  format: "outline" | "json";
  error: string | null;
}

const MAX_NODES = 5000;
const MAX_DEPTH = 64;

/** Parse a forest without merging duplicate names or counting a synthetic root. */
export function parseHierarchy(source: string): Hierarchy {
  const result: Hierarchy = {
    nodes: [],
    roots: [],
    leaves: 0,
    groups: 0,
    quantity: 0,
    depth: 0,
    format: "outline",
    error: null,
  };
  const byId = new Map<string, HierarchyNode>();
  function add(name: string, quantity: number, parentId: string | null, line: number | null) {
    if (!name.trim()) throw new Error(`${line ? `Line ${line}: ` : ""}Every entry needs a name.`);
    if (!Number.isFinite(quantity) || quantity < 0 || quantity > Number.MAX_SAFE_INTEGER) {
      throw new Error(`${line ? `Line ${line}: ` : ""}Quantity must be a non-negative, finite number.`);
    }
    if (result.nodes.length >= MAX_NODES) throw new Error(`Use up to ${MAX_NODES.toLocaleString()} entries per tree.`);
    const parent = parentId ? byId.get(parentId)! : null;
    const depth = parent ? parent.depth + 1 : 0;
    if (depth >= MAX_DEPTH) throw new Error(`Use up to ${MAX_DEPTH} nesting levels.`);
    const node: HierarchyNode = {
      id: `entry-${result.nodes.length}`,
      name: name.trim(),
      parentId,
      children: [],
      depth,
      branch: parent?.branch ?? result.roots.length,
      line,
      quantity,
      leafCount: 0,
      nodeCount: 1,
      quantityTotal: 0,
    };
    result.nodes.push(node);
    byId.set(node.id, node);
    if (parent) parent.children.push(node.id);
    else result.roots.push(node.id);
    return node;
  }

  try {
    const trimmed = source.trim();
    if (!trimmed) return result;
    // A markdown task starts with a bullet, so it cannot be mistaken for JSON.
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      result.format = "json";
      let value: unknown;
      try {
        value = JSON.parse(trimmed);
      } catch {
        throw new Error("Invalid JSON. Use a node or array of nodes with name and children fields.");
      }
      const work: { value: unknown; parentId: string | null }[] = (Array.isArray(value) ? value : [value]).map((value) => ({ value, parentId: null })).reverse();
      while (work.length) {
        const item = work.pop()!;
        if (typeof item.value === "string") {
          add(item.value, 1, item.parentId, null);
          continue;
        }
        if (!item.value || typeof item.value !== "object" || Array.isArray(item.value)) {
          throw new Error("JSON entries must be strings or objects with a name and optional children.");
        }
        const record = item.value as Record<string, unknown>;
        const name = record.name ?? record.label ?? record.title;
        if (typeof name !== "string") throw new Error("Each JSON object needs a string name, label, or title.");
        if (record.quantity !== undefined && typeof record.quantity !== "number") {
          throw new Error(`Quantity for “${name}” must be a number.`);
        }
        if (record.children !== undefined && !Array.isArray(record.children)) {
          throw new Error(`Children for “${name}” must be an array.`);
        }
        const node = add(name, (record.quantity as number | undefined) ?? 1, item.parentId, null);
        const children = (record.children ?? []) as unknown[];
        for (let i = children.length - 1; i >= 0; i--) work.push({ value: children[i], parentId: node.id });
      }
    } else {
      const stack: { indent: number; id: string }[] = [];
      for (const [index, raw] of source.split(/\r?\n/).entries()) {
        if (!raw.trim()) continue;
        const expanded = raw.replace(/\t/g, "    ");
        const indent = expanded.length - expanded.trimStart().length;
        let name = expanded
          .trim()
          .replace(/^(?:\d+[.)]|[-+*•])(?:\s+|$)/, "")
          .replace(/^\[[ xX]\](?:\s+|$)/, "");
        // Empty bullets and unfinished task markers are common in pasted outlines.
        if (!name.trim()) continue;
        let quantity = 1;
        const separator = name.lastIndexOf(" ::");
        if (separator !== -1) {
          const amount = name.slice(separator + 3).trim();
          if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(amount)) {
            throw new Error(`Line ${index + 1}: Write a quantity like “Kids :: 3”.`);
          }
          quantity = Number(amount);
          name = name.slice(0, separator);
        }
        while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
        const node = add(name, quantity, stack[stack.length - 1]?.id ?? null, index + 1);
        stack.push({ indent, id: node.id });
      }
    }

    // Parents precede descendants. Aggregate in reverse order without recursion.
    for (let i = result.nodes.length - 1; i >= 0; i--) {
      const node = result.nodes[i];
      if (!node.children.length) {
        node.leafCount = 1;
        node.quantityTotal = node.quantity;
        result.leaves++;
      } else result.groups++;
      result.depth = Math.max(result.depth, node.depth + 1);
      const parent = node.parentId ? byId.get(node.parentId) : null;
      if (parent) {
        parent.leafCount += node.leafCount;
        parent.nodeCount += node.nodeCount;
        parent.quantityTotal += node.quantityTotal;
        if (!Number.isFinite(parent.quantityTotal) || parent.quantityTotal > Number.MAX_SAFE_INTEGER) {
          throw new Error("The combined quantity is too large. Use a total below Number.MAX_SAFE_INTEGER.");
        }
      } else result.quantity += node.quantityTotal;
    }
    if (result.quantity > Number.MAX_SAFE_INTEGER) throw new Error("The combined quantity is too large.");
  } catch (error) {
    return { ...result, nodes: [], roots: [], leaves: 0, groups: 0, quantity: 0, depth: 0, error: error instanceof Error ? error.message : "Unable to read this hierarchy." };
  }
  return result;
}

/** Export portable JSON; computed totals and view-only state stay out of the data. */
export function hierarchyToJson(hierarchy: Hierarchy): string {
  type Entry = { name: string; quantity?: number; children?: Entry[] };
  const entries = new Map<string, Entry>();
  const roots: Entry[] = [];
  for (const node of hierarchy.nodes) {
    const entry: Entry = { name: node.name };
    if (node.quantity !== 1) entry.quantity = node.quantity;
    entries.set(node.id, entry);
    const parent = node.parentId ? entries.get(node.parentId) : null;
    if (parent) (parent.children ??= []).push(entry);
    else roots.push(entry);
  }
  return JSON.stringify(roots, null, 2);
}
