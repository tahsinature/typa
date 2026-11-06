import { describe, it, expect } from 'vitest';
import { spellOut } from '../transforms/present';

describe('spellOut', () => {
  it('names letters with NATO and distinguishes case', () => {
    expect(spellOut('aB')).toEqual([[
      { char: 'a', kind: 'lower', label: 'Alfa' },
      { char: 'B', kind: 'upper', label: 'Capital Bravo' },
    ]]);
  });

  it('tells look-alike characters apart', () => {
    expect(spellOut('0Ol1I')[0].map((c) => c.label)).toEqual([
      'Zero', 'Capital Oscar', 'Lima', 'One', 'Capital India',
    ]);
  });

  it('names spaces and symbols, falling back to a code point', () => {
    expect(spellOut(' -é')[0].map((c) => [c.kind, c.label])).toEqual([
      ['space', 'Space'],
      ['symbol', 'Hyphen'],
      ['symbol', 'U+00E9'],
    ]);
  });

  it('keeps line breaks (including empty lines) and emoji whole', () => {
    expect(spellOut('a\r\n\n😀').map((line) => line.map((c) => c.char))).toEqual([['a'], [], ['😀']]);
  });
});
