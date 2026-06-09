import { describe, it, expect } from 'vitest';
import { setNodeField } from '../transforms/json';
import { getTransform } from '../transforms/registry';

interface MultiNode {
  index: number;
  type: string;
  name?: string;
  status?: string;
  value: unknown;
  keys?: number;
  items?: number;
  error?: string;
}

const multi = getTransform('json-multi-view')!;

function run(input: string): MultiNode[] {
  const result = multi.fn(input) as { text: string; data: { nodes: MultiNode[] } };
  return result.data.nodes;
}

describe('json-multi-view: splitting', () => {
  it('splits NDJSON into one node per value, unnamed by default', () => {
    const nodes = run('{"a":1}\n{"b":2}');
    expect(nodes).toHaveLength(2);
    expect(nodes[0].name).toBeUndefined();
    expect(nodes[0].value).toEqual({ a: 1 });
    expect(nodes[1].value).toEqual({ b: 2 });
  });

  it('handles pretty-printed multi-line JSON values', () => {
    const nodes = run('// Pretty\n{\n  "a": 1,\n  "b": 2\n}');
    expect(nodes).toHaveLength(1);
    expect(nodes[0].name).toBe('Pretty');
    expect(nodes[0].value).toEqual({ a: 1, b: 2 });
  });

  it('does not treat // inside a string value as a comment', () => {
    const nodes = run('{"url":"http://example.com"}');
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe('object');
    expect(nodes[0].value).toEqual({ url: 'http://example.com' });
  });
});

describe('json-multi-view: naming via comment line', () => {
  it('names a node from a // comment line and leaves the data untouched', () => {
    const nodes = run('// Cart\n{"a":1}');
    expect(nodes[0].name).toBe('Cart');
    expect(nodes[0].value).toEqual({ a: 1 });
  });

  it('names a node from a # comment line', () => {
    const nodes = run('# Order\n{"a":1}');
    expect(nodes[0].name).toBe('Order');
  });

  it('uses the nearest comment when several precede a node', () => {
    const nodes = run('// first\n// second\n{"a":1}');
    expect(nodes[0].name).toBe('second');
  });

  it('labels non-object nodes too', () => {
    const nodes = run('// just a number\n42');
    expect(nodes[0].name).toBe('just a number');
    expect(nodes[0].type).toBe('number');
    expect(nodes[0].value).toBe(42);
  });
});

describe('json-multi-view: naming via object field', () => {
  it('names from _name and strips the key (with accurate key count)', () => {
    const nodes = run('{"_name":"Cart","a":1}');
    expect(nodes[0].name).toBe('Cart');
    expect(nodes[0].value).toEqual({ a: 1 });
    expect(nodes[0].keys).toBe(1);
  });

  it('supports the "//" key as a valid-JSON name', () => {
    const nodes = run('{"//":"Order","a":1}');
    expect(nodes[0].name).toBe('Order');
    expect(nodes[0].value).toEqual({ a: 1 });
  });

  it('respects key priority (_name over $name)', () => {
    const nodes = run('{"$name":"second","_name":"first","a":1}');
    expect(nodes[0].name).toBe('first');
    expect(nodes[0].value).toEqual({ $name: 'second', a: 1 });
  });

  it('ignores a non-string name key', () => {
    const nodes = run('{"_name":123,"a":1}');
    expect(nodes[0].name).toBeUndefined();
    expect(nodes[0].value).toEqual({ _name: 123, a: 1 });
  });
});

describe('json-multi-view: precedence', () => {
  it('prefers a comment line over an in-object field, leaving the field intact', () => {
    const nodes = run('// fromComment\n{"_name":"fromField","a":1}');
    expect(nodes[0].name).toBe('fromComment');
    expect(nodes[0].value).toEqual({ _name: 'fromField', a: 1 });
  });
});

describe('json-multi-view: status field', () => {
  it('pulls _status out of the data and exposes it as node.status', () => {
    const nodes = run('{"_status":"processed","a":1}');
    expect(nodes[0].status).toBe('processed');
    expect(nodes[0].value).toEqual({ a: 1 });
    expect(nodes[0].keys).toBe(1);
  });

  it('ignores a non-string _status', () => {
    const nodes = run('{"_status":123,"a":1}');
    expect(nodes[0].status).toBeUndefined();
    expect(nodes[0].value).toEqual({ _status: 123, a: 1 });
  });

  it('coexists with a comment-line name', () => {
    const nodes = run('// Cart\n{"_status":"done","a":1}');
    expect(nodes[0].name).toBe('Cart');
    expect(nodes[0].status).toBe('done');
    expect(nodes[0].value).toEqual({ a: 1 });
  });
});

describe('setNodeField', () => {
  it('adds a field to the chosen node, leaving others untouched', () => {
    expect(setNodeField('{"a":1}\n{"b":2}', 1, '_status', 'processed')).toBe(
      '{"a":1,"_status":"processed"}\n{"b":2}',
    );
    expect(setNodeField('{"a":1}\n{"b":2}', 2, '_status', 'done')).toBe(
      '{"a":1}\n{"b":2,"_status":"done"}',
    );
  });

  it('removes a field when value is undefined', () => {
    expect(setNodeField('{"a":1,"_status":"x"}\n{"b":2}', 1, '_status', undefined)).toBe(
      '{"a":1}\n{"b":2}',
    );
  });

  it('updates an existing field in place', () => {
    expect(setNodeField('{"a":1,"_status":"old"}', 1, '_status', 'new')).toBe(
      '{"a":1,"_status":"new"}',
    );
  });

  it('preserves comment lines and other nodes', () => {
    expect(setNodeField('// Cart\n{"a":1}\n// Order\n{"b":2}', 2, '_status', 'done')).toBe(
      '// Cart\n{"a":1}\n// Order\n{"b":2,"_status":"done"}',
    );
  });

  it('re-serializes only the edited (pretty-printed) node', () => {
    expect(setNodeField('{\n  "a": 1\n}\n{"b":2}', 1, '_status', 'x')).toBe(
      '{"a":1,"_status":"x"}\n{"b":2}',
    );
  });

  it('is a no-op for non-objects, out-of-range indexes, and absent keys', () => {
    expect(setNodeField('42\n{"a":1}', 1, '_status', 'x')).toBe('42\n{"a":1}');
    expect(setNodeField('{"a":1}', 5, '_status', 'x')).toBe('{"a":1}');
    expect(setNodeField('{"a":1}', 1, '_status', undefined)).toBe('{"a":1}');
  });

  it('round-trips: a marked node parses back with its status stripped', () => {
    const marked = setNodeField('{"a":1}\n{"b":2}', 1, '_status', 'processed');
    const nodes = run(marked);
    expect(nodes[0].status).toBe('processed');
    expect(nodes[0].value).toEqual({ a: 1 });
  });
});
