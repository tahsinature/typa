import { registerTransform } from './registry';
import type { NodeStatusConfig } from '../types';

const jsonOutputViews = ['raw-output', 'json-tree', 'json-diagram', 'table'];

registerTransform({
  id: 'json-format',
  name: 'Format JSON',
  description: 'Pretty-print JSON with 2-space indentation',
  category: 'JSON',
  inputViews: ['raw-input'],
  outputViews: jsonOutputViews,
  fn: (input) => JSON.stringify(JSON.parse(input), null, 2),
});

registerTransform({
  id: 'json-minify',
  name: 'Minify JSON',
  description: 'Remove all whitespace from JSON',
  category: 'JSON',
  inputViews: ['raw-input'],
  outputViews: ['raw-output'],
  fn: (input) => JSON.stringify(JSON.parse(input)),
});

function getJsonStats(value: unknown, depth = 0): { type: string; keys: number; items: number; depth: number } {
  if (Array.isArray(value)) {
    let maxDepth = depth;
    for (const item of value) {
      const sub = getJsonStats(item, depth + 1);
      maxDepth = Math.max(maxDepth, sub.depth);
    }
    return { type: 'array', keys: 0, items: value.length, depth: maxDepth };
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value);
    let maxDepth = depth;
    for (const [, v] of entries) {
      const sub = getJsonStats(v, depth + 1);
      maxDepth = Math.max(maxDepth, sub.depth);
    }
    return { type: 'object', keys: entries.length, items: 0, depth: maxDepth };
  }
  return { type: typeof value, keys: 0, items: 0, depth };
}

/* -- JS/TS to JSON -- */

function stripComments(code: string): string {
  return code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function jsObjectToJson(input: string): string {
  const cleaned = stripComments(input).trim();
  // eslint-disable-next-line no-new-func
  const result = new Function(`return (${cleaned})`)();
  return JSON.stringify(result, null, 2);
}

function tsTypeToJson(input: string): string {
  const cleaned = stripComments(input).trim();

  // Extract the body inside { ... } from interface/type declarations
  const match = cleaned.match(/(?:interface|type)\s+\w+(?:\s*=\s*)?\s*\{([\s\S]*)\}/);
  if (!match) throw new Error('Could not parse TypeScript type');

  return JSON.stringify(parseTypeBody(match[1]), null, 2);
}

function parseTypeBody(body: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  // Match property lines: key?: Type; or key: Type,
  const propRegex = /(\w+)\s*(\?)?\s*:\s*([^;,\n]+)/g;
  let m;

  while ((m = propRegex.exec(body)) !== null) {
    const [, key, , rawType] = m;
    result[key] = typeToExample(rawType.trim());
  }

  return result;
}

function typeToExample(type: string): unknown {
  // Handle arrays: string[] or Array<string>
  const arrayMatch = type.match(/^(.+)\[\]$/) || type.match(/^Array<(.+)>$/);
  if (arrayMatch) return [typeToExample(arrayMatch[1].trim())];

  // Handle inline object: { key: type; ... }
  if (type.startsWith('{')) {
    const inner = type.slice(1, type.lastIndexOf('}'));
    return parseTypeBody(inner);
  }

  // Handle union: pick first non-null/undefined type
  if (type.includes('|')) {
    const parts = type.split('|').map((t) => t.trim()).filter((t) => t !== 'null' && t !== 'undefined');
    if (parts.length > 0) return typeToExample(parts[0]);
    return null;
  }

  // Handle literal types
  if (type.startsWith('"') || type.startsWith("'")) return type.slice(1, -1);
  if (type === 'true') return true;
  if (type === 'false') return false;

  // Primitives
  switch (type) {
    case 'string': return '';
    case 'number': return 0;
    case 'boolean': return false;
    case 'null': return null;
    case 'undefined': return null;
    case 'any': case 'unknown': return null;
    case 'Date': return new Date().toISOString();
    default: return null;
  }
}

function isTypeDefinition(input: string): boolean {
  const trimmed = stripComments(input).trim();
  return /^(export\s+)?(interface|type)\s+/m.test(trimmed);
}

registerTransform({
  id: 'js-to-json',
  name: 'JS/TS to JSON',
  description: 'Convert JS object literals or TypeScript interfaces to JSON',
  category: 'JSON',
  inputViews: ['raw-input'],
  outputViews: jsonOutputViews,
  fn: (input) => {
    const trimmed = input.trim();
    if (!trimmed) return '{}';

    if (isTypeDefinition(trimmed)) {
      return tsTypeToJson(trimmed);
    }
    return jsObjectToJson(trimmed);
  },
});

registerTransform({
  id: 'json-normalize',
  name: 'Normalize JSON',
  description: 'Unescape a stringified JSON (literal \\n, \\t, \\/, etc.) and pretty-print it',
  category: 'JSON',
  inputViews: ['raw-input'],
  outputViews: jsonOutputViews,
  fn: (input) => {
    let trimmed = input.trim();
    // If wrapped in quotes, it's a JSON string literal — unwrap it first
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      trimmed = JSON.parse(trimmed);
    } else {
      // Otherwise, manually replace literal escape sequences
      trimmed = trimmed
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r')
        .replace(/\\\//g, '/')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    }
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  },
});

/**
 * A JSON value extracted from the input: its raw text, the `[start, end)`
 * offsets it occupies in the original input (used to patch a single node in
 * place), and an optional label from a `//` or `#` comment line above it.
 */
type JsonChunk = { raw: string; start: number; end: number; label?: string };

/**
 * Split input into individual JSON values by tracking nesting depth.
 * Handles both NDJSON (one value per line) and multi-line formatted JSON.
 *
 * A line starting with `//` or `#` between values is captured as the label for
 * the next value (the nearest comment wins). Markers are only honored in the
 * whitespace between values, so a `//` or `#` inside a string stays untouched.
 */
function splitJsonValues(input: string): JsonChunk[] {
  const results: JsonChunk[] = [];
  if (!input.trim()) return results;

  let i = 0;
  const len = input.length;
  let label: string | undefined;

  while (i < len) {
    // Skip whitespace and comment lines between values.
    while (i < len) {
      if (/\s/.test(input[i])) { i++; continue; }
      const isSlash = input[i] === '/' && input[i + 1] === '/';
      const isHash = input[i] === '#';
      if (!isSlash && !isHash) break;
      const cStart = i + (isSlash ? 2 : 1);
      let cEnd = cStart;
      while (cEnd < len && input[cEnd] !== '\n') cEnd++;
      const text = input.slice(cStart, cEnd).trim();
      if (text) label = text;
      i = cEnd;
    }
    if (i >= len) break;

    const start = i;
    const ch = input[i];

    // Object or array: track nesting
    if (ch === '{' || ch === '[') {
      const open = ch;
      const close = ch === '{' ? '}' : ']';
      let depth = 1;
      let j = i + 1;
      let inStr = false;

      while (j < len && depth > 0) {
        const c = input[j];
        if (inStr) {
          if (c === '\\') { j++; } // skip escaped char
          else if (c === '"') { inStr = false; }
        } else {
          if (c === '"') { inStr = true; }
          else if (c === open) { depth++; }
          else if (c === close) { depth--; }
        }
        j++;
      }

      results.push({ raw: input.slice(start, j), start, end: j, label });
      label = undefined;
      i = j;
      continue;
    }

    // String literal
    if (ch === '"') {
      let j = i + 1;
      while (j < len) {
        if (input[j] === '\\') { j += 2; continue; }
        if (input[j] === '"') { j++; break; }
        j++;
      }
      results.push({ raw: input.slice(start, j), start, end: j, label });
      label = undefined;
      i = j;
      continue;
    }

    // Number, boolean, null — read until delimiter
    {
      let j = i;
      while (j < len && !/[\s,\]}]/.test(input[j])) j++;
      results.push({ raw: input.slice(start, j), start, end: j, label });
      label = undefined;
      i = j;
    }
  }

  return results;
}

/**
 * Add, update, or remove a top-level field on the object at `nodeIndex`
 * (1-based) in NDJSON / multi-JSON `input`, returning the new input. Only the
 * targeted object is re-serialized; every other node, comment line, and bit of
 * whitespace is preserved. Passing `value === undefined` removes the key. If
 * the node isn't an object (or doesn't exist), the input is returned unchanged.
 */
export function setNodeField(
  input: string,
  nodeIndex: number,
  key: string,
  value: string | number | boolean | null | undefined,
): string {
  const chunk = splitJsonValues(input)[nodeIndex - 1];
  if (!chunk) return input;

  let parsed: unknown;
  try {
    parsed = JSON.parse(chunk.raw);
  } catch {
    return input;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return input;
  }

  const obj = parsed as Record<string, unknown>;
  if (value === undefined) {
    if (!(key in obj)) return input;
    delete obj[key];
  } else {
    obj[key] = value;
  }

  return input.slice(0, chunk.start) + JSON.stringify(obj) + input.slice(chunk.end);
}

/** Object keys recognized as a node's name, in priority order. */
const NAME_KEYS = ['_name', '$name', '//'];

/**
 * If an object has a recognized name key with a non-empty string value, return
 * that name plus a copy of the object with the key removed (so the meta key
 * doesn't clutter the data tree). Otherwise return the object untouched.
 */
function extractObjectName(obj: Record<string, unknown>): { name?: string; value: Record<string, unknown> } {
  for (const key of NAME_KEYS) {
    const candidate = obj[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      const value = { ...obj };
      delete value[key];
      return { name: candidate, value };
    }
  }
  return { value: obj };
}

const STATUS_FIELD = '_status';

/** Example status config: the NDJSON viewer lets you mark each node. */
const MULTI_STATUS: NodeStatusConfig = {
  field: STATUS_FIELD,
  options: [
    { value: 'processed', label: 'Processed', color: '#34d058' },
    { value: 'skipped', label: 'Skipped', color: '#9ca3af' },
    { value: 'error', label: 'Error', color: '#f85149' },
  ],
};

type MultiJsonNode = {
  index: number;
  type: string;
  value: unknown;
  name?: string;
  status?: string;
  keys?: number;
  items?: number;
  raw: string;
  error?: string;
};

registerTransform({
  id: 'json-multi-view',
  name: 'Multi JSON / NDJSON Viewer',
  description: 'View multiple JSON nodes (NDJSON, paste formatted or minified JSON values)',
  category: 'JSON',
  inputViews: ['raw-input'],
  outputViews: ['json-multi', 'json-diagram', 'raw-output'],
  tips: [
    'Name a node with a `// label` or `# label` line above it.',
    'Or add a `_name`, `$name`, or `"//"` field inside an object — the key is hidden from the data.',
    'Names show in each node’s header so you can tell records apart.',
    'Mark a node from its header (processed / skipped / error) to track progress.',
  ],
  nodeStatus: MULTI_STATUS,
  fn: (input) => {
    const chunks = splitJsonValues(input);
    const nodes: MultiJsonNode[] = [];

    let idx = 0;
    for (const { raw, label } of chunks) {
      idx++;
      try {
        const parsed = JSON.parse(raw);
        const type = Array.isArray(parsed)
          ? 'array'
          : parsed === null
            ? 'null'
            : typeof parsed;

        let value: unknown = parsed;
        let name = label;
        let status: string | undefined;
        if (type === 'object') {
          let obj = parsed as Record<string, unknown>;
          // A comment line wins as the name; otherwise an object may name
          // itself via a recognized key, which is stripped from the tree.
          if (!name) {
            const named = extractObjectName(obj);
            name = named.name;
            obj = named.value;
          }
          // A status marker is always pulled out of the data and surfaced as
          // node.status (shown as a badge, not a raw field).
          const rawStatus = obj[STATUS_FIELD];
          if (typeof rawStatus === 'string' && rawStatus) {
            status = rawStatus;
            obj = { ...obj };
            delete obj[STATUS_FIELD];
          }
          value = obj;
        }

        const node: MultiJsonNode = { index: idx, type, value, raw };
        if (name) node.name = name;
        if (status) node.status = status;
        if (type === 'object') node.keys = Object.keys(value as Record<string, unknown>).length;
        if (type === 'array') node.items = (parsed as unknown[]).length;
        nodes.push(node);
      } catch (e) {
        nodes.push({
          index: idx,
          type: 'error',
          value: null,
          raw,
          error: (e as Error).message,
        });
      }
    }

    return JSON.stringify({ nodes });
  },
});

registerTransform({
  id: 'json-validate',
  name: 'Validate JSON',
  description: 'Check if input is valid JSON',
  category: 'JSON',
  inputViews: ['raw-input'],
  outputViews: ['validation', 'raw-output'],
  fn: (input) => {
    if (!input.trim()) {
      return JSON.stringify({ valid: false, format: 'JSON', error: { message: 'Input is empty' } });
    }
    try {
      const parsed = JSON.parse(input);
      const stats = getJsonStats(parsed);
      const size = new Blob([input]).size;
      return JSON.stringify({
        valid: true,
        format: 'JSON',
        stats: {
          ...stats,
          size,
          sizeFormatted: size > 1024 ? `${(size / 1024).toFixed(1)} KB` : `${size} B`,
        },
      });
    } catch (e) {
      const msg = (e as Error).message;
      const posMatch = msg.match(/position\s+(\d+)/i);
      let line: number | undefined;
      let column: number | undefined;
      if (posMatch) {
        const pos = parseInt(posMatch[1]);
        const before = input.slice(0, pos);
        line = (before.match(/\n/g) || []).length + 1;
        column = pos - before.lastIndexOf('\n');
      }
      return JSON.stringify({
        valid: false,
        format: 'JSON',
        error: { message: msg, line, column },
      });
    }
  },
});
