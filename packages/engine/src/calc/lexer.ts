import { CalcError } from './values';
import { CURRENCY_SYMBOLS } from './currencies';

export type TokenType = 'number' | 'ident' | 'currency' | 'op' | 'eof';

export interface Token {
  type: TokenType;
  text: string;
  /** Parsed value for number tokens. */
  value?: number;
  start: number;
  end: number;
}

const OPERATORS = ['**', '+=', '-=', '*=', '/=', '+', '-', '−', '*', '×', '·', '/', '÷', '^', '%', '!', '(', ')', ',', '='];
const NORMALIZED_OPS: Record<string, string> = { '−': '-', '×': '*', '÷': '/', '**': '^' };

const IDENT_START = /[\p{L}_°µμΩÅ′″]/u;
const IDENT_PART = /[\p{L}\p{N}_°µμΩÅ′″²³]/u;

function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch >= '0' && ch <= '9';
}

/** Splits an expression into tokens. Thousands commas ("1,234,567") stay inside numbers. */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let parenDepth = 0;

  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    const start = i;
    if (isDigit(ch) || (ch === '.' && isDigit(input[i + 1]))) {
      const { value, end } = readNumber(input, i, parenDepth === 0);
      tokens.push({ type: 'number', text: input.slice(start, end), value, start, end });
      i = end;
      continue;
    }

    const symbol = CURRENCY_SYMBOLS.find((symbol) => input.startsWith(symbol, i));
    if (symbol) {
      i += symbol.length;
      tokens.push({ type: 'currency', text: symbol, start, end: i });
      continue;
    }

    if (IDENT_START.test(ch)) {
      while (i < input.length && IDENT_PART.test(input[i])) i++;
      tokens.push({ type: 'ident', text: input.slice(start, i), start, end: i });
      continue;
    }

    const op = OPERATORS.find((o) => input.startsWith(o, i));
    if (op) {
      if (op === '(') parenDepth++;
      if (op === ')') parenDepth--;
      tokens.push({ type: 'op', text: NORMALIZED_OPS[op] ?? op, start, end: i + op.length });
      i += op.length;
      continue;
    }

    throw new CalcError(`Unexpected "${ch}"`);
  }

  tokens.push({ type: 'eof', text: '', start: input.length, end: input.length });
  return tokens;
}

function readNumber(input: string, start: number, allowGrouping: boolean): { value: number; end: number } {
  const prefixed = input.slice(start).match(/^0([xbo])([0-9a-f]+)/i);
  if (prefixed) {
    const radix = { x: 16, b: 2, o: 8 }[prefixed[1].toLowerCase() as 'x' | 'b' | 'o'];
    const value = parseInt(prefixed[2], radix);
    if (Number.isNaN(value) || !isValidInRadix(prefixed[2], radix)) throw new CalcError(`Invalid number "${prefixed[0]}"`);
    return { value, end: start + prefixed[0].length };
  }

  let i = start;
  let digits = '';
  while (isDigit(input[i])) digits += input[i++];
  // "1,234,567": a comma followed by exactly three digits continues the number.
  while (allowGrouping && input[i] === ',' && /^\d{3}(?!\d)/.test(input.slice(i + 1, i + 5))) {
    digits += input.slice(i + 1, i + 4);
    i += 4;
  }
  if (input[i] === '.' && isDigit(input[i + 1])) {
    digits += input[i++];
    while (isDigit(input[i])) digits += input[i++];
  }
  const exponent = input.slice(i).match(/^[eE][+-]?\d+/);
  if (exponent) {
    digits += exponent[0];
    i += exponent[0].length;
  }
  return { value: parseFloat(digits), end: i };
}

function isValidInRadix(digits: string, radix: number): boolean {
  return [...digits].every((d) => parseInt(d, 16) < radix);
}
