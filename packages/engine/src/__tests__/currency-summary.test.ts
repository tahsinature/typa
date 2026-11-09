import { describe, expect, it } from 'vitest';
import { TypaEngine } from '../engine';
import { FALLBACK_RATES } from '../calc/currencies';

describe('Currency input', () => {
  it.each(Object.keys(FALLBACK_RATES))('accepts %s before and after an amount', (code) => {
    const engine = new TypaEngine();
    const results = engine.evaluateDocument(`${code} 20\n20 ${code}\n${code.toLowerCase()} 20\n20 ${code.toLowerCase()}`);
    expect(results[0].error).toBeNull();
    expect(results.map((result) => result.error)).toEqual([null, null, null, null]);
    expect(new Set(results.map((result) => result.result)).size).toBe(1);
    const [pasted] = engine.evaluateDocument(results[0].result!);
    expect(pasted.error).toBeNull();
    expect(pasted.result).toBe(results[0].result);
  });

  it.each([
    ['cad 20', '$20.00 CAD'], ['C$20', '$20.00 CAD'], ['CAD $20', '$20.00 CAD'],
    ['$20 CAD', '$20.00 CAD'], ['€20 EUR', '€20.00'], ['$-20 CAD', '-$20.00 CAD'],
    ['EUR €20', '€20.00'], ['£20', '£20.00'], ['GBP -20', '-£20.00'],
    ['A$20', '$20.00 AUD'], ['HK$20', '$20.00 HKD'], ['NZ$20', '$20.00 NZD'],
    ['CAD (10 + 20)', '$30.00 CAD'], ['EUR 2k', '€2,000.00'],
    ['EUR 20 + EUR 30', '€50.00'], ['€20 + 10%', '€22.00'],
    ['PSN Subscription C$105.64', '$105.64 CAD'],
    ['FiFA purchase CAD $101.69', '$101.69 CAD'],
    ['Gym yearly membership CAD 291.24', '$291.24 CAD'],
    ['"GTA 6" CAD 124.29', '$124.29 CAD'],
  ])('evaluates %s', (input, expected) => {
    const [result] = new TypaEngine().evaluateDocument(input);
    expect(result.error).toBeNull();
    expect(result.result).toBe(expected);
  });

  it('rejects conflicting currency symbols', () => {
    const [result] = new TypaEngine().evaluateDocument('CAD €20');
    expect(result.error).toBe('Conflicting currency symbols');
  });

  it('preserves variable precedence over currency codes', () => {
    const results = new TypaEngine().evaluateDocument('CAD = 3\nCAD * 20');
    expect(results[1].result).toBe('60');
  });
});

describe('Sheet and selection summaries', () => {
  it('totals the whole sheet and returns to it after a selection', () => {
    const engine = new TypaEngine();
    engine.evaluateDocument('10\n20\n30');
    expect(engine.summarize()).toEqual({ sum: '60', average: '20', count: 3 });
    expect(engine.summarize([1, 2])).toEqual({ sum: '30', average: '15', count: 2 });
    expect(engine.summarize().sum).toBe('60');
  });

  it('excludes comments, failed expressions and standalone aggregates from the sheet total', () => {
    const engine = new TypaEngine();
    engine.evaluateDocument('10\n20\n// note\n1 / 0\ntotal\navg');
    expect(engine.summarize()).toEqual({ sum: '30', average: '15', count: 2 });
    expect(engine.summarize([5]).sum).toBe('30');
  });

  it('preserves a single currency and converts mixed currencies to USD in any order', () => {
    const engine = new TypaEngine();
    engine.setCurrencyRates({ CAD: 2 });
    engine.evaluateDocument('CAD 20\nCAD 40');
    expect(engine.summarize().sum).toBe('$60.00 CAD');
    for (const input of ['CAD 20\nUSD 10', 'USD 10\nCAD 20']) {
      engine.evaluateDocument(input);
      expect(engine.summarize()).toEqual({ sum: '$20.00', average: '$10.00', count: 2 });
      expect(engine.summarize([1, 2]).sum).toBe('$20.00');
    }
  });

  it('returns no total for an empty or invalid selection, and keeps zero totals', () => {
    const engine = new TypaEngine();
    engine.evaluateDocument('// note\n1 / 0\n10\n-10');
    expect(engine.summarize([1, 2])).toEqual({ sum: null, average: null, count: 0 });
    expect(engine.summarize().sum).toBe('0');
  });
});
