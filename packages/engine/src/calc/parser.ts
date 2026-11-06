import type { ConversionTarget, Node, PercentRelation } from './ast';
import { tokenize, type Token } from './lexer';
import { CalcError, type UnitTerm } from './values';
import { LENGTH, powDims, sameDims } from './dimensions';

export interface ParseContext {
  isVariable(name: string): boolean;
  isFunction(name: string): boolean;
  /** Resolves a unit or currency spelling ("km", "m²", "euros", "€"). */
  findUnit(text: string): UnitTerm | undefined;
}

/** Words that act as operators, so they can never be variables or units. */
const KEYWORDS = new Set([
  'in', 'to', 'as', 'into', 'of', 'on', 'off', 'plus', 'minus', 'times', 'mul', 'and', 'with',
  'without', 'subtract', 'multiplied', 'divided', 'divide', 'by', 'per', 'mod', 'what', 'is',
]);
const CONVERSION_WORDS = new Set(['in', 'to', 'as', 'into']);

const SCALES: Record<string, number> = {
  k: 1e3, M: 1e6, thousand: 1e3, thousands: 1e3, million: 1e6, millions: 1e6,
  billion: 1e9, billions: 1e9, bn: 1e9, trillion: 1e12, trillions: 1e12,
  hundred: 100, hundreds: 100, dozen: 12, dozens: 12, lakh: 1e5, lakhs: 1e5, crore: 1e7, crores: 1e7,
};
const CASE_SENSITIVE_SCALES = new Set(['k', 'M']);

const FRACTIONS: Record<string, number> = { half: 1 / 2, quarter: 1 / 4, third: 1 / 3 };

/** Functions that may be written without parentheses, e.g. "sqrt 16". */
const PREFIX_FUNCTIONS = new Set([
  'sqrt', 'cbrt', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh',
  'ln', 'log', 'log2', 'log10', 'exp', 'abs', 'round', 'floor', 'ceil',
]);

const FORMAT_TARGETS: Record<string, ConversionTarget> = {
  hex: { kind: 'format', format: 'hex' }, hexadecimal: { kind: 'format', format: 'hex' },
  bin: { kind: 'format', format: 'binary' }, binary: { kind: 'format', format: 'binary' },
  oct: { kind: 'format', format: 'octal' }, octal: { kind: 'format', format: 'octal' },
  dec: { kind: 'format', format: 'decimal' }, decimal: { kind: 'format', format: 'decimal' },
  sci: { kind: 'format', format: 'scientific' }, scientific: { kind: 'format', format: 'scientific' },
  percent: { kind: 'percent' }, percentage: { kind: 'percent' },
  unix: { kind: 'unix' }, timestamp: { kind: 'unix' },
};

const ASSIGN_OPS: Record<string, '=' | '+' | '-' | '*' | '/'> = { '=': '=', '+=': '+', '-=': '-', '*=': '*', '/=': '/' };

export function isKeyword(word: string): boolean {
  return KEYWORDS.has(word.toLowerCase());
}

/** Operator words, conversion targets and scale words, for syntax highlighting. */
export function keywordSpellings(): string[] {
  return [...KEYWORDS, ...Object.keys(FORMAT_TARGETS), ...Object.keys(SCALES), ...Object.keys(FRACTIONS), 'double', 'triple'];
}

export function parse(input: string, ctx: ParseContext): Node {
  return new Parser(tokenize(input), ctx).parseStatement();
}

class Parser {
  private pos = 0;

  constructor(private tokens: Token[], private ctx: ParseContext) {}

  /* ── Token helpers ── */

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
  }

  private next(): Token {
    return this.tokens[this.pos++];
  }

  private isOp(text: string, offset = 0): boolean {
    const t = this.peek(offset);
    return t.type === 'op' && t.text === text;
  }

  private isWord(word: string, offset = 0): boolean {
    const t = this.peek(offset);
    return t.type === 'ident' && t.text.toLowerCase() === word;
  }

  private matchWords(...words: string[]): boolean {
    if (!words.every((w, i) => this.isWord(w, i))) return false;
    this.pos += words.length;
    return true;
  }

  private matchOp(text: string): boolean {
    if (!this.isOp(text)) return false;
    this.pos++;
    return true;
  }

  private expectOp(text: string): void {
    if (!this.matchOp(text)) throw this.unexpected();
  }

  private unexpected(): CalcError {
    const t = this.peek();
    return new CalcError(t.type === 'eof' ? 'Incomplete expression' : `Unexpected "${t.text}"`);
  }

  private isConversionWordAt(offset: number): boolean {
    const t = this.peek(offset);
    return t.type === 'ident' && CONVERSION_WORDS.has(t.text.toLowerCase());
  }

  /* ── Statements ── */

  parseStatement(): Node {
    const first = this.peek();
    const op = this.peek(1);
    if (first.type === 'ident' && !isKeyword(first.text) && op.type === 'op' && op.text in ASSIGN_OPS) {
      this.pos += 2;
      const expr = this.parseConversion();
      this.expectEnd();
      return { type: 'assign', name: first.text, op: ASSIGN_OPS[op.text], expr };
    }
    const expr = this.parseConversion();
    this.expectEnd();
    return expr;
  }

  private expectEnd(): void {
    if (this.peek().type !== 'eof') throw this.unexpected();
  }

  /* ── Conversion: "x to km", "x in hex", "x as a % of y" ── */

  private parseConversion(): Node {
    let expr = this.parseAdditive();
    while (this.isConversionWordAt(0)) {
      const asPercent = this.tryAsPercent(expr);
      if (asPercent) return asPercent;
      this.pos++;
      expr = { type: 'convert', expr, target: this.parseTarget() };
    }
    return expr;
  }

  /** "X as a % of Y", "X as % on Y", "X as a percentage off Y". */
  private tryAsPercent(part: Node): Node | null {
    if (!this.isWord('as')) return null;
    let offset = 1;
    if (this.isWord('a', offset)) offset++;
    if (!this.isOp('%', offset) && !this.isWord('percent', offset) && !this.isWord('percentage', offset)) return null;
    const relation = this.peek(offset + 1).text.toLowerCase();
    if (relation !== 'of' && relation !== 'on' && relation !== 'off') return null;
    this.pos += offset + 2;
    return { type: 'asPercent', relation: relation as PercentRelation, part, base: this.parseAdditive() };
  }

  private parseTarget(): ConversionTarget {
    if (this.matchOp('%')) return { kind: 'percent' };
    const t = this.peek();
    const format = t.type === 'ident' ? FORMAT_TARGETS[t.text.toLowerCase()] : undefined;
    if (format) {
      this.pos++;
      return format;
    }
    const units = this.parseUnitList();
    if (!units) throw new CalcError(t.type === 'eof' ? 'Missing unit to convert to' : `Unknown unit "${t.text}"`);
    return { kind: 'units', units };
  }

  /* ── Arithmetic ── */

  private parseAdditive(): Node {
    let left = this.parseMultiplicative();
    for (;;) {
      let op: '+' | '-' | null = null;
      if (this.matchOp('+') || this.matchWords('plus') || this.matchWords('and') || this.matchWords('with')) op = '+';
      else if (this.matchOp('-') || this.matchWords('minus') || this.matchWords('subtract') || this.matchWords('without')) op = '-';
      if (!op) return left;
      left = { type: 'binary', op, left, right: this.parseMultiplicative() };
    }
  }

  private parseMultiplicative(): Node {
    let left = this.parseUnary();
    for (;;) {
      if (this.matchOp('*') || this.matchOp('·') || this.matchWords('multiplied', 'by') || this.matchWords('times') || this.matchWords('mul')) {
        left = { type: 'binary', op: '*', left, right: this.parseUnary() };
      } else if (
        this.matchOp('/') || this.matchWords('divided', 'by') || this.matchWords('divide', 'by') ||
        this.matchWords('divide') || this.matchWords('per')
      ) {
        left = { type: 'binary', op: '/', left, right: this.parseUnary() };
      } else if (this.matchWords('mod') || this.matchModuloSign()) {
        left = { type: 'binary', op: 'mod', left, right: this.parseUnary() };
      } else if (this.isWord('of') || this.isWord('on') || this.isWord('off')) {
        left = this.parsePercentRelation(left);
      } else if (this.startsImplicitOperand()) {
        left = { type: 'binary', op: '*', left, right: this.parseUnary() };
      } else {
        return left;
      }
    }
  }

  /** "17 % 5": a % sign followed by a number or "(" is modulo, not a percentage. */
  private startsModuloOperand(offset: number): boolean {
    return this.peek(offset).type === 'number' || this.isOp('(', offset);
  }

  private matchModuloSign(): boolean {
    if (!this.isOp('%') || !this.startsModuloOperand(1)) return false;
    this.pos++;
    return true;
  }

  private parsePercentRelation(percent: Node): Node {
    const relation = this.next().text.toLowerCase() as PercentRelation;
    if (this.matchWords('what', 'is')) {
      return { type: 'percentWhat', relation, percent, result: this.parseAdditive() };
    }
    return { type: 'percentOf', relation, percent, base: this.parseUnary() };
  }

  /** "2 pi", "3(4 + 1)", "2 x": juxtaposition means multiplication. */
  private startsImplicitOperand(): boolean {
    const t = this.peek();
    if (t.type === 'op') return t.text === '(';
    return t.type === 'ident' && !isKeyword(t.text);
  }

  private parseUnary(): Node {
    if (this.matchOp('-')) return { type: 'negate', expr: this.parseUnary() };
    if (this.matchOp('+')) return this.parseUnary();
    if (this.matchWords('double')) return { type: 'binary', op: '*', left: { type: 'number', value: 2 }, right: this.parseUnary() };
    if (this.matchWords('triple')) return { type: 'binary', op: '*', left: { type: 'number', value: 3 }, right: this.parseUnary() };
    return this.parsePostfix();
  }

  /* ── Postfix: units, scales and percent after a value ── */

  private parsePostfix(): Node {
    let expr = this.parsePower();
    let hasUnits = false;
    for (;;) {
      if (this.isOp('%') && this.startsModuloOperand(1)) {
        return expr;
      }
      if (this.matchOp('%')) {
        expr = { type: 'percent', expr };
        continue;
      }
      const scale = this.scaleAt(0);
      if (scale !== undefined && !hasUnits) {
        this.pos++;
        expr = { type: 'binary', op: '*', left: expr, right: { type: 'number', value: scale } };
        continue;
      }
      const units = this.ctx.isVariable(this.peek().text) ? null : this.parseUnitList();
      if (units) {
        expr = { type: 'withUnits', expr, units };
        hasUnits = true;
        const extra = this.parseMixedUnits(units);
        if (extra) expr = { type: 'binary', op: '+', left: expr, right: extra };
        continue;
      }
      return expr;
    }
  }

  private scaleAt(offset: number): number | undefined {
    const t = this.peek(offset);
    if (t.type !== 'ident') return undefined;
    if (CASE_SENSITIVE_SCALES.has(t.text)) return SCALES[t.text];
    const lower = t.text.toLowerCase();
    return CASE_SENSITIVE_SCALES.has(lower) ? undefined : SCALES[lower];
  }

  /** "5 ft 3 in": a number and unit of the same kind continues the quantity. */
  private parseMixedUnits(previous: UnitTerm[]): Node | null {
    if (previous.length !== 1 || this.peek().type !== 'number') return null;
    const saved = this.pos;
    const value = this.next().value!;
    const term = this.unitTermAt(0);
    const prevDims = powDims(previous[0].unit.dims, previous[0].power);
    if (term && sameDims(powDims(term.term.unit.dims, term.term.power), prevDims)) {
      this.pos += term.length;
      return { type: 'withUnits', expr: { type: 'number', value }, units: [term.term] };
    }
    this.pos = saved;
    return null;
  }

  private parsePower(): Node {
    const base = this.parseFactorial();
    if (!this.matchOp('^')) return base;
    return { type: 'binary', op: '^', left: base, right: this.parseExponent() };
  }

  private parseExponent(): Node {
    if (this.matchOp('-')) return { type: 'negate', expr: this.parseExponent() };
    if (this.matchOp('+')) return this.parseExponent();
    return this.parsePower();
  }

  private parseFactorial(): Node {
    let expr = this.parsePrimary();
    while (this.matchOp('!')) expr = { type: 'factorial', expr };
    return expr;
  }

  /* ── Primary values ── */

  private parsePrimary(): Node {
    const t = this.peek();

    if (t.type === 'number') {
      this.pos++;
      return { type: 'number', value: t.value! };
    }

    if (this.matchOp('(')) {
      const expr = this.parseConversion();
      this.expectOp(')');
      return expr;
    }

    if (t.type === 'currency') {
      // "$20", "€2k": the symbol applies to the amount that follows.
      const unit = this.ctx.findUnit(t.text)!;
      this.pos++;
      return { type: 'withUnits', expr: this.parsePostfix(), units: [unit] };
    }

    if (t.type === 'ident' && !isKeyword(t.text)) return this.parseIdentifier(t.text);

    throw this.unexpected();
  }

  private parseIdentifier(name: string): Node {
    if (this.ctx.isVariable(name)) {
      this.pos++;
      return { type: 'name', name };
    }

    const lower = name.toLowerCase();
    if (lower in FRACTIONS) {
      this.pos++;
      return { type: 'number', value: FRACTIONS[lower] };
    }

    if (this.ctx.isFunction(lower)) {
      if (this.isOp('(', 1)) {
        this.pos += 2;
        return { type: 'call', name: lower, args: this.parseArguments() };
      }
      if (PREFIX_FUNCTIONS.has(lower) && this.startsPrefixArgument(1)) {
        this.pos++;
        return { type: 'call', name: lower, args: [this.parseUnary()] };
      }
    }

    // Multi-token unit spellings used on their own, e.g. "sq ft to m2" or "fl oz".
    const unit = this.unitTermAt(0);
    if (unit && unit.length > 1) {
      this.pos += unit.length;
      return { type: 'withUnits', expr: { type: 'number', value: 1 }, units: [unit.term] };
    }

    this.pos++;
    return { type: 'name', name };
  }

  private startsPrefixArgument(offset: number): boolean {
    const t = this.peek(offset);
    return t.type === 'number' || t.type === 'currency' || (t.type === 'ident' && !isKeyword(t.text)) || this.isOp('-', offset);
  }

  private parseArguments(): Node[] {
    const args: Node[] = [];
    if (this.matchOp(')')) return args;
    do args.push(this.parseConversion());
    while (this.matchOp(','));
    this.expectOp(')');
    return args;
  }

  /* ── Units ── */

  /** Parses "km", "km/h", "m^2", "kg·m", "sq ft" or "USD per kg". */
  private parseUnitList(): UnitTerm[] | null {
    const first = this.unitTermAt(0);
    if (!first) return null;
    this.pos += first.length;
    const units: UnitTerm[] = [first.term];

    for (;;) {
      const divides = this.isOp('/') || this.isWord('per');
      const multiplies = this.isOp('*') || this.isOp('·');
      if (divides || multiplies) {
        const term = this.unitTermAt(1);
        if (!term) break;
        this.pos += 1 + term.length;
        units.push({ unit: term.term.unit, power: divides ? -term.term.power : term.term.power });
      } else if (this.isOp('^') && this.peek(1).type === 'number') {
        this.pos++;
        const last = units[units.length - 1];
        units[units.length - 1] = { unit: last.unit, power: last.power * this.next().value! };
      } else {
        break;
      }
    }
    return units;
  }

  /** Looks ahead for a unit spelling without consuming tokens. */
  private unitTermAt(offset: number): { term: UnitTerm; length: number } | null {
    const t = this.peek(offset);
    if (t.type === 'currency') {
      const term = this.ctx.findUnit(t.text);
      return term ? { term, length: 1 } : null;
    }
    if (t.type !== 'ident' || isKeyword(t.text) && !this.isInch(offset)) return null;
    if (this.scaleAt(offset) !== undefined) return null;
    // "min(", "max(": a function call, not a unit.
    if (this.isOp('(', offset + 1) && this.ctx.isFunction(t.text.toLowerCase())) return null;

    const lower = t.text.toLowerCase();
    const next = this.peek(offset + 1);
    if (next.type === 'ident') {
      const power = lower === 'sq' || lower === 'square' ? 2 : ['cubic', 'cu', 'cb'].includes(lower) ? 3 : 0;
      if (power) {
        const base = this.ctx.findUnit(next.text);
        if (base && base.power === 1 && sameDims(base.unit.dims, LENGTH)) {
          return { term: { unit: base.unit, power }, length: 2 };
        }
      }
      const twoWords = this.ctx.findUnit(`${t.text} ${next.text}`);
      if (twoWords) return { term: twoWords, length: 2 };
    }

    if (lower === 'in') return { term: this.ctx.findUnit('inch')!, length: 1 };
    const term = this.ctx.findUnit(t.text);
    return term ? { term, length: 1 } : null;
  }

  /** "5 in" means inches only at the end or before a conversion ("5 in to cm"). */
  private isInch(offset: number): boolean {
    if (!this.isWord('in', offset)) return false;
    const after = this.peek(offset + 1);
    return after.type === 'eof' || this.isOp(')', offset + 1) || this.isConversionWordAt(offset + 1);
  }
}
