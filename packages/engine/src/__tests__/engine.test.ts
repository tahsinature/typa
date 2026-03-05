import { describe, it, expect } from 'vitest';
import { TypaEngine } from '../engine';

describe('TypaEngine', () => {
  const engine = new TypaEngine();

  it('evaluates basic arithmetic', () => {
    const results = engine.evaluateDocument('2 + 3');
    expect(results[0].result).toBe('5');
  });

  it('handles variables', () => {
    const results = engine.evaluateDocument('x = 10\nx * 2');
    expect(results[0].result).toBe('10');
    expect(results[1].result).toBe('20');
  });

  it('skips comments and empty lines', () => {
    const results = engine.evaluateDocument('// comment\n\n# also comment\n5');
    expect(results[0].result).toBeNull();
    expect(results[1].result).toBeNull();
    expect(results[2].result).toBeNull();
    expect(results[3].result).toBe('5');
  });

  it('handles Numi-style percentages', () => {
    const results = engine.evaluateDocument('100 + 10%');
    expect(results[0].result).toBe('110');
  });

  it('handles unit conversions', () => {
    const results = engine.evaluateDocument('5 inch to cm');
    expect(results[0].result).toContain('cm');
  });

  it('supports line references', () => {
    const results = engine.evaluateDocument('10\n20\nline1 + line2');
    expect(results[2].result).toBe('30');
  });

  it('supports prev reference', () => {
    const results = engine.evaluateDocument('42\nprev * 2');
    expect(results[1].result).toBe('84');
  });

  it('supports sum and avg', () => {
    const results = engine.evaluateDocument('10\n20\n30\nsum');
    expect(results[3].result).toBe('60');
  });

  it('returns errors for invalid expressions', () => {
    const results = engine.evaluateDocument('foo bar baz');
    expect(results[0].error).toBeTruthy();
    expect(results[0].result).toBeNull();
  });

  it('formats large numbers with commas', () => {
    const results = engine.evaluateDocument('1000000');
    expect(results[0].result).toBe('1,000,000');
  });
});
