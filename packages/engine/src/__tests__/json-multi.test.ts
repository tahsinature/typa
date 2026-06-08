import { describe, it, expect } from 'vitest';
import '../transforms/json';
import { getTransform } from '../transforms/registry';

interface MultiNode {
  index: number;
  type: string;
  name?: string;
  value: unknown;
  keys?: number;
  items?: number;
  error?: string;
}

const multi = getTransform('json-multi-view')!;

function run(input: string): MultiNode[] {
  return (JSON.parse(multi.fn(input)) as { nodes: MultiNode[] }).nodes;
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
