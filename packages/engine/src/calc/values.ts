import {
  type Dims, NONE, TIME, POWER, mulDims, divDims, powDims, sameDims, isDimensionless, describeDims,
} from './dimensions';
import { type UnitDef, namedUnitFor, hourUnitFor } from './units';

export class CalcError extends Error {}

export type DisplayFormat = 'hex' | 'binary' | 'octal' | 'scientific';

export interface UnitTerm { unit: UnitDef; power: number }

/** A number with an optional unit. `value` is stored in SI base units. */
export interface Quantity {
  kind: 'quantity';
  value: number;
  dims: Dims;
  units: UnitTerm[];
  format?: DisplayFormat;
}

/** "5%" is stored as ratio 0.05 and applied relative to the other operand. */
export interface Percent { kind: 'percent'; ratio: number }

export interface DateValue { kind: 'date'; ms: number; dateOnly: boolean }

export type Value = Quantity | Percent | DateValue;

export const num = (value: number): Quantity => ({ kind: 'quantity', value, dims: NONE, units: [] });
export const percent = (ratio: number): Percent => ({ kind: 'percent', ratio });
export const date = (ms: number, dateOnly: boolean): DateValue => ({ kind: 'date', ms, dateOnly });

function unitsDims(units: UnitTerm[]): Dims {
  return units.reduce<Dims>((d, t) => mulDims(d, powDims(t.unit.dims, t.power)), NONE);
}

function unitsFactor(units: UnitTerm[]): number {
  return units.reduce((f, t) => f * t.unit.factor ** t.power, 1);
}

/** The single temperature-like unit whose zero is offset (°C, °F), if any. */
function offsetUnit(units: UnitTerm[]): UnitDef | undefined {
  return units.length === 1 && units[0].power === 1 && units[0].unit.offset !== undefined
    ? units[0].unit
    : undefined;
}

/** Value expressed in the quantity's own units, e.g. 5 for "5 km". */
export function displayValue(q: Quantity): number {
  const offset = offsetUnit(q.units);
  if (offset) return q.value / offset.factor - offset.offset!;
  return q.value / unitsFactor(q.units);
}

/** Builds a quantity from a number expressed in the given units. */
export function fromDisplay(n: number, units: UnitTerm[]): Quantity {
  const offset = offsetUnit(units);
  const value = offset ? (n + offset.offset!) * offset.factor : n * unitsFactor(units);
  return { kind: 'quantity', value, dims: unitsDims(units), units };
}

export function attachUnit(q: Quantity, units: UnitTerm[]): Quantity {
  if (q.units.length > 0) throw new CalcError(`Unexpected unit after ${q.units[0].unit.symbol}`);
  return fromDisplay(q.value, units);
}

function scale(q: Quantity, k: number): Quantity {
  return offsetUnit(q.units) ? { ...fromDisplay(displayValue(q) * k, q.units), format: q.format } : { ...q, value: q.value * k };
}

function assertQuantity(v: Value, op: string): Quantity {
  if (v.kind === 'quantity') return v;
  throw new CalcError(`Can't ${op} a ${v.kind === 'date' ? 'date' : 'percentage'} here`);
}

function mismatch(op: string, a: Quantity, b: Quantity): CalcError {
  return new CalcError(`Can't ${op} ${describeDims(a.dims)} and ${describeDims(b.dims)}`);
}

/* ── Addition and subtraction ── */

export function add(a: Value, b: Value, sign: 1 | -1 = 1): Value {
  if (b.kind === 'percent') {
    if (a.kind === 'percent') return percent(a.ratio + sign * b.ratio);
    return scale(assertQuantity(a, 'add'), 1 + sign * b.ratio);
  }
  if (a.kind === 'date') return addToDate(a, b, sign);
  if (b.kind === 'date') {
    if (sign === 1) return addToDate(b, a, 1);
    throw new CalcError("Can't subtract a date from a number");
  }
  if (a.kind === 'percent') throw new CalcError(`Can't ${sign === 1 ? 'add' : 'subtract'} a number and a percentage this way`);
  return addQuantities(a, b, sign);
}

function addQuantities(a: Quantity, b: Quantity, sign: 1 | -1): Quantity {
  // "$5 + 2" reads as "$5 + $2", so a bare number adopts the other side's unit.
  if (a.units.length && isDimensionless(b.dims)) b = fromDisplay(b.value, a.units);
  if (b.units.length && isDimensionless(a.dims)) a = fromDisplay(a.value, b.units);
  if (!sameDims(a.dims, b.dims)) throw mismatch(sign === 1 ? 'add' : 'subtract', a, b);

  const units = pickSumUnits(a, b, a.value + sign * b.value);
  if (offsetUnit(units)) {
    const bInA = displayValue({ ...b, units });
    return { ...fromDisplay(displayValue({ ...a, units }) + sign * bInA, units), format: a.format };
  }
  return { ...a, value: a.value + sign * b.value, units, format: a.format ?? b.format };
}

/** Shows a sum in the left unit, unless only the right unit gives a whole number ("3 d + 4 h" = 76 h). */
function pickSumUnits(a: Quantity, b: Quantity, value: number): UnitTerm[] {
  if (!a.units.length) return b.units;
  if (!b.units.length || offsetUnit(a.units)) return a.units;
  const isWhole = (units: UnitTerm[]) => Number.isInteger(parseFloat((value / unitsFactor(units)).toPrecision(12)));
  return !isWhole(a.units) && isWhole(b.units) ? b.units : a.units;
}

function addToDate(d: DateValue, v: Value, sign: 1 | -1): Value {
  if (v.kind === 'date') {
    if (sign === 1) throw new CalcError("Can't add two dates");
    const seconds = (d.ms - v.ms) / 1000;
    const unit = Math.abs(seconds) >= 2 * 86400 || (d.dateOnly && v.dateOnly) ? 'd' : 'h';
    return withTimeUnit(seconds, unit);
  }
  const q = assertQuantity(v, 'add');
  if (!sameDims(q.dims, TIME)) throw new CalcError(`Can't add ${describeDims(q.dims)} to a date`);
  const ms = d.ms + sign * q.value * 1000;
  return date(ms, d.dateOnly && q.value % 86400 === 0);
}

let timeUnitLookup: ((symbol: string) => UnitDef) | null = null;
export function setTimeUnitLookup(fn: (symbol: string) => UnitDef): void {
  timeUnitLookup = fn;
}

function withTimeUnit(seconds: number, symbol: string): Quantity {
  const unit = timeUnitLookup!(symbol);
  return { kind: 'quantity', value: seconds, dims: TIME, units: [{ unit, power: 1 }] };
}

/* ── Multiplication and division ── */

export function multiply(a: Value, b: Value): Value {
  if (a.kind === 'percent' && b.kind === 'percent') return percent(a.ratio * b.ratio);
  if (a.kind === 'percent') return multiply(b, a);
  if (b.kind === 'percent') {
    const q = assertQuantity(a, 'multiply');
    return scale(q, b.ratio);
  }
  const qa = assertQuantity(a, 'multiply');
  const qb = assertQuantity(b, 'multiply');
  if (isDimensionless(qb.dims)) return { ...scale(qa, qb.value), format: qa.format ?? qb.format };
  if (isDimensionless(qa.dims)) return { ...scale(qb, qa.value), format: qa.format ?? qb.format };
  return combine(qa.value * qb.value, qa.units, qb.units, 1);
}

export function divide(a: Value, b: Value): Value {
  if (b.kind === 'percent') {
    if (b.ratio === 0) throw new CalcError('Division by zero');
    if (a.kind === 'percent') return num(a.ratio / b.ratio);
    return scale(assertQuantity(a, 'divide'), 1 / b.ratio);
  }
  const qb = assertQuantity(b, 'divide');
  if (qb.value === 0) throw new CalcError('Division by zero');
  if (a.kind === 'percent') {
    if (!isDimensionless(qb.dims)) throw new CalcError("Can't divide a percentage by a unit");
    return percent(a.ratio / qb.value);
  }
  const qa = assertQuantity(a, 'divide');
  if (isDimensionless(qb.dims)) return { ...scale(qa, 1 / qb.value), format: qa.format };
  return combine(qa.value / qb.value, qa.units, qb.units, -1);
}

/** Merges unit lists for × and ÷, reusing the left unit when both sides measure the same thing. */
function combine(value: number, left: UnitTerm[], right: UnitTerm[], sign: 1 | -1): Quantity {
  const terms = left.map((t) => ({ ...t }));
  for (const t of right) {
    const same = terms.find((x) => sameDims(x.unit.dims, t.unit.dims) && x.unit.offset === undefined);
    if (same) same.power += sign * t.power;
    else terms.push({ unit: t.unit, power: sign * t.power });
  }
  const units = terms.filter((t) => t.power !== 0);
  const d = unitsDims(units);
  return { kind: 'quantity', value, dims: d, units: isDimensionless(d) ? [] : simplify(units, d) };
}

/** Names common compound results: V × A → W, kg·m/s² → N, kW × h → kWh. */
function simplify(units: UnitTerm[], d: Dims): UnitTerm[] {
  if (units.length < 2) return units;
  const coherent = units.every((t) => t.unit.electrical) || units.every((t) => t.unit.factor === 1 && t.unit.offset === undefined);
  if (coherent) {
    const named = namedUnitFor(d);
    if (named) return [{ unit: named, power: 1 }];
  }
  if (units.length === 2) {
    const [p, h] = units;
    if (sameDims(p.unit.dims, POWER) && p.power === 1 && h.unit.symbol === 'h' && h.power === 1) {
      const wh = hourUnitFor(p.unit);
      if (wh) return [{ unit: wh, power: 1 }];
    }
  }
  return units;
}

export function power(a: Value, b: Value): Value {
  const base = assertQuantity(a, 'raise');
  const exp = assertQuantity(b, 'raise');
  if (!isDimensionless(exp.dims)) throw new CalcError('Exponent must be a plain number');
  const p = exp.value;
  if (isDimensionless(base.dims)) return { ...num(base.value ** p), format: base.format };
  if (!Number.isInteger(p)) throw new CalcError('Units can only be raised to whole powers');
  const units = base.units.map((t) => ({ unit: t.unit, power: t.power * p }));
  return { kind: 'quantity', value: base.value ** p, dims: powDims(base.dims, p), units };
}

export function negate(v: Value): Value {
  if (v.kind === 'percent') return percent(-v.ratio);
  if (v.kind === 'date') throw new CalcError("Can't negate a date");
  return scale(v, -1);
}

/* ── Conversion ── */

export function convert(v: Value, units: UnitTerm[]): Quantity {
  const q = assertQuantity(v, 'convert');
  const target = unitsDims(units);
  if (!sameDims(q.dims, target)) {
    throw new CalcError(`Can't convert ${describeDims(q.dims)} to ${describeDims(target)}`);
  }
  return { ...q, units };
}

/** Plain number of a dimensionless value, for functions and formats. */
export function toNumber(v: Value, what: string): number {
  if (v.kind === 'percent') return v.ratio;
  const q = assertQuantity(v, what);
  if (!isDimensionless(q.dims)) throw new CalcError(`${what} needs a plain number, not ${describeDims(q.dims)}`);
  return q.value;
}
