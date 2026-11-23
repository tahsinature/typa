import { parseHierarchy } from "@typa/engine";

/** A new object represents each explicit edit action, even for the same node. */
export interface NodeEditRequest {
  id: string;
  source: string;
}
interface SourceRange { start: number; end: number }
interface JsonValue extends SourceRange {
  value?: unknown;
  properties?: Map<string, JsonValue>;
  items?: JsonValue[];
}

/** Read positions from valid JSON without rewriting whitespace or matching names. */
function readJsonPositions(source: string): JsonValue {
  const tokens = [...source.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|[^\s{}\[\]:,]+/g)];
  let cursor = 0;
  function read(): JsonValue {
    const token = tokens[cursor++];
    const start = token.index!;
    if (token[0] === "{") {
      const properties = new Map<string, JsonValue>();
      while (tokens[cursor][0] !== "}") {
        const key = JSON.parse(tokens[cursor++][0]) as string;
        cursor++; // Colon.
        properties.set(key, read());
        if (tokens[cursor][0] === ",") cursor++;
      }
      return { start, end: tokens[cursor++].index! + 1, properties };
    }
    if (token[0] === "[") {
      const items: JsonValue[] = [];
      while (tokens[cursor][0] !== "]") {
        items.push(read());
        if (tokens[cursor][0] === ",") cursor++;
      }
      return { start, end: tokens[cursor++].index! + 1, items };
    }
    return { start, end: start + token[0].length, value: JSON.parse(token[0]) };
  }
  return read();
}

export function getNodeSourceRange(source: string, id: string): SourceRange | null {
  const tree = parseHierarchy(source);
  const index = tree.nodes.findIndex((node) => node.id === id);
  if (tree.error || index < 0) return null;
  const node = tree.nodes[index];
  if (node.line !== null) {
    const lines = source.split("\n");
    const raw = lines[node.line - 1];
    const offset = lines.slice(0, node.line - 1).reduce((sum, line) => sum + line.length + 1, 0);
    const prefix = raw.match(/^\s*(?:(?:\d+[.)]|[-+*•])(?:\s+|$))?(?:\[[ xX]\](?:\s+|$))?/)?.[0].length ?? 0;
    const quantity = raw.lastIndexOf(" ::");
    const label = raw.slice(prefix, quantity >= prefix ? quantity : undefined).trimEnd();
    return { start: offset + prefix, end: offset + prefix + label.length };
  }
  try {
    const root = readJsonPositions(source);
    const pending = [...(root.items ?? [root])].reverse();
    let position = 0;
    while (pending.length) {
      const entry = pending.pop()!;
      const properties = entry.properties;
      const label = properties
        ? ["name", "label", "title"].map((key) => properties.get(key)).find((value) => value && value.value != null)
        : entry;
      if (position++ === index) {
        // Select only the string contents, leaving JSON quotes intact.
        return label ? { start: label.start + 1, end: label.end - 1 } : null;
      }
      const children = properties?.get("children")?.items ?? [];
      for (let child = children.length - 1; child >= 0; child--) pending.push(children[child]);
    }
  } catch {
    return null;
  }
  return null;
}
