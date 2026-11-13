import { CurrencyTable } from './currencies';
import { evaluate, type EvalScope } from './evaluator';
import { CONSTANTS, FUNCTIONS } from './functions';
import { formatValue } from './format';
import { isKeyword, parse, type ParseContext } from './parser';
import { resolveUnit, findUnit } from './units';
import {
  CalcError, type UnitTerm, type Value, add, divide, num, date, setTimeUnitLookup, fromDisplay,
} from './values';

setTimeUnitLookup((symbol) => findUnit(symbol)!);

export interface LineOutcome {
  line: number;
  input: string;
  value: Value | null;
  result: string | null;
  error: string | null;
  item?: string;
  calculation?: string;
}

const DAY_MS = 86400000;

/** A line that splits "sum"/"avg" blocks: blank lines and headings. */
function isBlockBreak(trimmed: string): boolean {
  return !trimmed || trimmed.startsWith('#');
}

/** Separates explicit labels from expressions and removes notes and comments. */
function lineParts(raw: string): { item: string; expression: string } | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) return null;
  let expr = trimmed;
  const label = expr.match(/^([A-Za-z][\w\s]*?):\s+(.+)$/);
  if (label) expr = label[2];
  expr = expr.replace(/"[^"]*"/g, ' ').replace(/\s\/\/.*$/, '').trim();
  return expr ? { item: label?.[1].trim() ?? '', expression: expr } : null;
}

/** Removes everything that isn't part of the expression: labels, "quoted notes" and // comments. */
export function expressionOf(raw: string): string | null {
  return lineParts(raw)?.expression ?? null;
}

export class Calculator {
  readonly currencies = new CurrencyTable();
  private variables = new Map<string, Value>();
  private now: () => number;

  constructor(options: { now?: () => number } = {}) {
    this.now = options.now ?? Date.now;
  }

  evaluate(text: string): LineOutcome[] {
    this.variables = new Map();
    const outcomes: LineOutcome[] = [];
    let blockStart = 0;

    text.split('\n').forEach((raw, index) => {
      if (isBlockBreak(raw.trim())) blockStart = index + 1;
      const parts = lineParts(raw);
      const base = { line: index + 1, input: raw };
      if (parts === null) {
        outcomes.push({ ...base, value: null, result: null, error: null });
        return;
      }
      const expr = parts.expression;
      const block = outcomes.slice(blockStart);
      try {
        const { value, calculation } = this.evaluateExpression(expr, outcomes, block);
        const leadingLabel = expr.slice(0, expr.length - calculation.length).trim();
        const item = [parts.item, leadingLabel].filter(Boolean).join(' ');
        outcomes.push({ ...base, item, calculation, value, result: formatValue(value), error: null });
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        outcomes.push({ ...base, item: parts.item, calculation: expr, value: null, result: null, error });
      }
    });
    return outcomes;
  }

  /** Variables defined by the last evaluate() call, for autocomplete. */
  variableNames(): string[] {
    return [...this.variables.keys()];
  }

  /** Adds values together, skipping the ones that can't be added to the rest. */
  static sum(values: Value[]): { sum: Value | null; count: number } {
    let sum: Value | null = null;
    let count = 0;
    for (const v of values) {
      if (v.kind !== 'quantity') continue;
      try {
        sum = sum ? add(sum, v) : v;
        count++;
      } catch {
        // Incompatible units (e.g. km and kg) are left out of the total.
      }
    }
    return { sum, count };
  }

  private evaluateExpression(expr: string, previous: LineOutcome[], block: LineOutcome[]): { value: Value; calculation: string } {
    const scope = this.scopeFor(previous, block);
    const context = this.parseContext();
    try {
      return { value: evaluate(parse(expr, context), scope), calculation: expr };
    } catch (error) {
      // "Rent 1200": ignore leading words that mean nothing to the calculator.
      const rest = this.withoutLeadingWord(expr);
      if (!rest) throw error;
      try {
        return this.evaluateExpression(rest, previous, block);
      } catch {
        throw error;
      }
    }
  }

  private withoutLeadingWord(expr: string): string | null {
    const match = expr.match(/^([A-Za-z][\w'’]*)\s+(.+)$/);
    if (!match || this.isKnownWord(match[1])) return null;
    return match[2];
  }

  private isKnownWord(word: string): boolean {
    const lower = word.toLowerCase();
    return isKeyword(word) || this.variables.has(word) || lower in CONSTANTS || lower in FUNCTIONS
      || this.findUnit(word) !== undefined || DOCUMENT_NAMES.has(lower) || /^line\d+$/.test(lower)
      || ['double', 'triple', 'half', 'quarter', 'third', 'sq', 'square', 'cubic'].includes(lower);
  }

  findUnit(text: string): UnitTerm | undefined {
    const unit = resolveUnit(text);
    if (unit) return unit;
    const currency = this.currencies.find(text);
    return currency ? { unit: currency, power: 1 } : undefined;
  }

  private parseContext(): ParseContext {
    return {
      isVariable: (name) => this.variables.has(name),
      isFunction: (name) => name in FUNCTIONS,
      findUnit: (text) => this.findUnit(text),
    };
  }

  private scopeFor(previous: LineOutcome[], block: LineOutcome[]): EvalScope {
    return {
      variables: this.variables,
      resolveName: (name) => this.documentName(name.toLowerCase(), previous, block),
      resolveUnit: (name) => {
        const term = this.findUnit(name);
        return term ? fromDisplay(1, [term]) : undefined;
      },
    };
  }

  private documentName(name: string, previous: LineOutcome[], block: LineOutcome[]): Value | undefined {
    const blockValues = block.map((o) => o.value).filter((v): v is Value => v !== null);
    switch (name) {
      case 'prev': {
        const last = [...previous].reverse().find((o) => o.value);
        if (!last) throw new CalcError('There is no previous result');
        return last.value!;
      }
      case 'sum':
      case 'total':
        return Calculator.sum(blockValues).sum ?? num(0);
      case 'avg':
      case 'average': {
        const { sum, count } = Calculator.sum(blockValues);
        return sum ? divide(sum, num(count)) : num(0);
      }
      case 'now': return date(this.now(), false);
      case 'today': return date(this.midnight(), true);
      case 'tomorrow': return date(this.midnight() + DAY_MS, true);
      case 'yesterday': return date(this.midnight() - DAY_MS, true);
    }
    const lineRef = name.match(/^line(\d+)$/);
    if (lineRef) {
      const outcome = previous[Number(lineRef[1]) - 1];
      if (!outcome?.value) throw new CalcError(`Line ${lineRef[1]} has no result`);
      return outcome.value;
    }
    return undefined;
  }

  private midnight(): number {
    const d = new Date(this.now());
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
}

const DOCUMENT_NAMES = new Set(['prev', 'sum', 'total', 'avg', 'average', 'now', 'today', 'tomorrow', 'yesterday']);
