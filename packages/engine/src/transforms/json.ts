import { registerTransform } from './registry';

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
