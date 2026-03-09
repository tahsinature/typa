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

describe('Natural language', () => {
  const engine = new TypaEngine();

  it('handles "N% of X"', () => {
    const results = engine.evaluateDocument('20% of 500');
    expect(results[0].result).toBe('100');
  });

  it('handles "half of X"', () => {
    const results = engine.evaluateDocument('half of 100');
    expect(results[0].result).toBe('50');
  });

  it('handles "quarter of X"', () => {
    const results = engine.evaluateDocument('quarter of 200');
    expect(results[0].result).toBe('50');
  });

  it('handles "third of X"', () => {
    const results = engine.evaluateDocument('third of 300');
    expect(results[0].result).toBe('100');
  });

  it('handles "double X"', () => {
    const results = engine.evaluateDocument('double 25');
    expect(results[0].result).toBe('50');
  });

  it('handles "triple X"', () => {
    const results = engine.evaluateDocument('triple 10');
    expect(results[0].result).toBe('30');
  });
});

describe('Word operators', () => {
  const engine = new TypaEngine();

  it('handles "times"', () => {
    const results = engine.evaluateDocument('8 times 9');
    expect(results[0].result).toBe('72');
  });

  it('handles "plus"', () => {
    const results = engine.evaluateDocument('5 plus 3');
    expect(results[0].result).toBe('8');
  });

  it('handles "minus"', () => {
    const results = engine.evaluateDocument('10 minus 4');
    expect(results[0].result).toBe('6');
  });

  it('handles "and"', () => {
    const results = engine.evaluateDocument('5 and 3');
    expect(results[0].result).toBe('8');
  });

  it('handles "with" and "without"', () => {
    const results = engine.evaluateDocument('10 with 5\n15 without 3');
    expect(results[0].result).toBe('15');
    expect(results[1].result).toBe('12');
  });

  it('handles "multiplied by"', () => {
    const results = engine.evaluateDocument('6 multiplied by 7');
    expect(results[0].result).toBe('42');
  });

  it('handles "divided by" / "divide by"', () => {
    const results = engine.evaluateDocument('20 divided by 4\n15 divide by 3');
    expect(results[0].result).toBe('5');
    expect(results[1].result).toBe('5');
  });
});

describe('Scales', () => {
  const engine = new TypaEngine();

  it('handles k (thousands)', () => {
    const results = engine.evaluateDocument('2k + 500');
    expect(results[0].result).toBe('2,500');
  });

  it('handles M (millions)', () => {
    const results = engine.evaluateDocument('5M');
    expect(results[0].result).toBe('5,000,000');
  });

  it('handles "thousand", "million", "billion"', () => {
    const results = engine.evaluateDocument('3 thousand\n2.5 million\n1 billion');
    expect(results[0].result).toBe('3,000');
    expect(results[1].result).toBe('2,500,000');
    expect(results[2].result).toBe('1,000,000,000');
  });
});

describe('Percentage operations', () => {
  const engine = new TypaEngine();

  it('handles "N% on X" (add percentage)', () => {
    const results = engine.evaluateDocument('5% on 30');
    expect(results[0].result).toBe('31.5');
  });

  it('handles "N% off X" (subtract percentage)', () => {
    const results = engine.evaluateDocument('6% off 40');
    const num = parseFloat(results[0].result!);
    expect(num).toBeCloseTo(37.6, 1);
  });

  it('handles "X as a % of Y"', () => {
    const results = engine.evaluateDocument('50 as a % of 100');
    expect(results[0].result).toBe('50');
  });

  it('handles "X as a % on Y"', () => {
    const results = engine.evaluateDocument('70 as a % on 20');
    expect(results[0].result).toBe('250');
  });

  it('handles "N% of what is X"', () => {
    const results = engine.evaluateDocument('5% of what is 6');
    expect(results[0].result).toBe('120');
  });

  it('handles "N% on what is X"', () => {
    const results = engine.evaluateDocument('5% on what is 6');
    const num = parseFloat(results[0].result!);
    expect(num).toBeCloseTo(5.714, 2);
  });
});

describe('Labels and comments', () => {
  const engine = new TypaEngine();

  it('handles labels with colon', () => {
    const results = engine.evaluateDocument('Price: 11 + 34');
    expect(results[0].result).toBe('45');
  });

  it('strips inline double-quoted comments', () => {
    const results = engine.evaluateDocument('275 + 25');
    expect(results[0].result).toBe('300');
  });

  it('handles double-slash comments', () => {
    const results = engine.evaluateDocument('// This is a comment');
    expect(results[0].result).toBeNull();
  });
});

describe('Currency conversion', () => {
  const engine = new TypaEngine();
  engine.setCurrencyRates({ USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149.5, CAD: 1.36 });

  it('converts USD to EUR', () => {
    const results = engine.evaluateDocument('100 USD to EUR');
    expect(results[0].result).toContain('EUR');
    const num = parseFloat(results[0].result!);
    expect(num).toBeCloseTo(92, 0);
  });

  it('converts EUR to USD', () => {
    const results = engine.evaluateDocument('92 EUR to USD');
    expect(results[0].result).toContain('USD');
    const num = parseFloat(results[0].result!);
    expect(num).toBeCloseTo(100, 0);
  });

  it('handles lowercase currency codes', () => {
    const results = engine.evaluateDocument('10 usd to eur');
    expect(results[0].result).toContain('EUR');
  });

  it('handles currency names', () => {
    const results = engine.evaluateDocument('50 dollars to euros');
    expect(results[0].result).toContain('EUR');
  });

  it('handles "in" for currency conversion', () => {
    const results = engine.evaluateDocument('100 USD in GBP');
    expect(results[0].result).toContain('GBP');
  });

  it('formats currency with 2 decimal places', () => {
    const results = engine.evaluateDocument('1 USD to EUR');
    expect(results[0].result).toMatch(/^\d+\.\d{2}\s+EUR$/);
  });

  it('handles currency symbols ($)', () => {
    const results = engine.evaluateDocument('$100 to EUR');
    expect(results[0].result).toContain('EUR');
    const num = parseFloat(results[0].result!);
    expect(num).toBeCloseTo(92, 0);
  });
});

describe('CSS units', () => {
  const engine = new TypaEngine();

  it('converts pt to px', () => {
    const results = engine.evaluateDocument('12 pt to px');
    expect(results[0].result).toContain('px');
    const num = parseFloat(results[0].result!);
    expect(num).toBeCloseTo(16, 0);
  });

  it('converts em to px', () => {
    const results = engine.evaluateDocument('1 em to px');
    expect(results[0].result).toContain('px');
    const num = parseFloat(results[0].result!);
    expect(num).toBeCloseTo(16, 0);
  });

  it('converts px to inch', () => {
    const results = engine.evaluateDocument('96 px to inch');
    expect(results[0].result).toContain('inch');
    const num = parseFloat(results[0].result!);
    expect(num).toBeCloseTo(1, 1);
  });
});

describe('Area and volume prefixes', () => {
  const engine = new TypaEngine();

  it('handles "sq cm"', () => {
    const results = engine.evaluateDocument('20 sq cm to sq inch');
    expect(results[0].error).toBeNull();
  });

  it('handles "cubic cm"', () => {
    const results = engine.evaluateDocument('1000 cubic cm to liter');
    expect(results[0].result).toContain('liter');
  });
});

describe('Unit aliases', () => {
  const engine = new TypaEngine();

  it('handles KB (uppercase)', () => {
    const results = engine.evaluateDocument('1024 KB to MB');
    expect(results[0].result).toContain('MB');
  });

  it('handles degree sign', () => {
    const results = engine.evaluateDocument('sin(90°)');
    const num = parseFloat(results[0].result!);
    expect(num).toBeCloseTo(1, 5);
  });
});

describe('Sum and average aliases', () => {
  const engine = new TypaEngine();

  it('handles "total"', () => {
    const results = engine.evaluateDocument('10\n20\n30\ntotal');
    expect(results[3].result).toBe('60');
  });

  it('handles "average"', () => {
    const results = engine.evaluateDocument('10\n20\n30\naverage');
    expect(results[3].result).toBe('20');
  });
});
