import { registerTransform } from './registry';

export type SpelledCharKind = 'upper' | 'lower' | 'digit' | 'space' | 'symbol';

export interface SpelledChar {
  char: string;
  kind: SpelledCharKind;
  label: string;
}

const NATO: Record<string, string> = {
  a: 'Alfa', b: 'Bravo', c: 'Charlie', d: 'Delta', e: 'Echo', f: 'Foxtrot',
  g: 'Golf', h: 'Hotel', i: 'India', j: 'Juliett', k: 'Kilo', l: 'Lima',
  m: 'Mike', n: 'November', o: 'Oscar', p: 'Papa', q: 'Quebec', r: 'Romeo',
  s: 'Sierra', t: 'Tango', u: 'Uniform', v: 'Victor', w: 'Whiskey', x: 'X-ray',
  y: 'Yankee', z: 'Zulu',
};

const DIGITS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

const SYMBOLS: Record<string, string> = {
  '!': 'Exclamation', '@': 'At', '#': 'Hash', $: 'Dollar', '%': 'Percent',
  '^': 'Caret', '&': 'Ampersand', '*': 'Asterisk', '(': 'Open paren', ')': 'Close paren',
  '-': 'Hyphen', _: 'Underscore', '=': 'Equals', '+': 'Plus', '[': 'Open bracket',
  ']': 'Close bracket', '{': 'Open brace', '}': 'Close brace', '\\': 'Backslash',
  '|': 'Pipe', ';': 'Semicolon', ':': 'Colon', "'": 'Apostrophe', '"': 'Quote',
  ',': 'Comma', '.': 'Period', '<': 'Less than', '>': 'Greater than', '/': 'Slash',
  '?': 'Question', '`': 'Backtick', '~': 'Tilde',
};

function spellChar(char: string): SpelledChar {
  if (char === ' ') return { char, kind: 'space', label: 'Space' };
  if (char === '\t') return { char, kind: 'space', label: 'Tab' };
  if (/[0-9]/.test(char)) return { char, kind: 'digit', label: DIGITS[Number(char)] };

  const nato = NATO[char.toLowerCase()];
  if (nato && char === char.toUpperCase()) return { char, kind: 'upper', label: `Capital ${nato}` };
  if (nato) return { char, kind: 'lower', label: nato };

  return { char, kind: 'symbol', label: SYMBOLS[char] ?? `U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}` };
}

/** Breaks text into lines of characters, each with a readable name (NATO for letters). */
export function spellOut(text: string): SpelledChar[][] {
  return text.split(/\r?\n/).map((line) => Array.from(line).map(spellChar));
}

registerTransform({
  id: 'present',
  name: 'Present',
  description: 'Show text big, spelled out character by character, or as a QR code',
  category: 'Text',
  inputViews: ['raw-input'],
  outputViews: ['present-big-text', 'present-spell-out', 'present-qr-code'],
  fn: (input) => ({ text: input, data: spellOut(input) }),
});
