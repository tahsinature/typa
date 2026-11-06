import { ANGLE, isDimensionless, sameDims } from './dimensions';
import {
  CalcError, type Quantity, type Value, num, date, displayValue, fromDisplay, toNumber, add, divide,
} from './values';

type Fn = (args: Value[]) => Value;

export const CONSTANTS: Record<string, number> = {
  pi: Math.PI, 'π': Math.PI, e: Math.E, tau: 2 * Math.PI, 'τ': 2 * Math.PI, phi: (1 + Math.sqrt(5)) / 2,
};

function arity(name: string, args: Value[], min: number, max = min): void {
  if (args.length < min || args.length > max) {
    const expected = min === max ? `${min}` : `${min}–${max}`;
    throw new CalcError(`${name}() takes ${expected} argument${max === 1 ? '' : 's'}`);
  }
}

/** Removes floating-point dust such as sin(π) = 1.2e-16. */
function clean(n: number): number {
  return Math.abs(n) < 1e-12 ? 0 : n;
}

/** Trig input: angles convert to radians, plain numbers are already radians. */
function radians(v: Value, name: string): number {
  if (v.kind === 'quantity' && sameDims(v.dims, ANGLE)) return v.value;
  return toNumber(v, name);
}

function unary(name: string, f: (n: number) => number): Fn {
  return (args) => {
    arity(name, args, 1);
    const result = f(toNumber(args[0], name));
    if (Number.isNaN(result)) throw new CalcError(`${name}() is undefined for this value`);
    return num(result);
  };
}

function trig(name: string, f: (n: number) => number): Fn {
  return (args) => {
    arity(name, args, 1);
    return num(clean(f(radians(args[0], name))));
  };
}

function quantity(v: Value, name: string): Quantity {
  if (v.kind === 'quantity') return v;
  if (v.kind === 'percent') return num(v.ratio);
  throw new CalcError(`${name}() needs a number`);
}

/** Rounding helpers keep the unit: round(2.567 km, 1) = 2.6 km. */
function rounding(name: string, f: (n: number) => number): Fn {
  return (args) => {
    arity(name, args, 1, 2);
    const q = quantity(args[0], name);
    const digits = args[1] ? toNumber(args[1], name) : 0;
    const k = 10 ** digits;
    return { ...fromDisplay(f(displayValue(q) * k) / k, q.units), format: q.format };
  };
}

function root(name: string, degree: number): Fn {
  return (args) => {
    arity(name, args, 1);
    const q = quantity(args[0], name);
    if (isDimensionless(q.dims)) {
      if (degree === 2 && q.value < 0) throw new CalcError("Can't take the square root of a negative number");
      return num(degree === 2 ? Math.sqrt(q.value) : Math.cbrt(q.value));
    }
    if (!q.units.every((t) => t.power % degree === 0)) throw new CalcError(`Can't take ${name}() of these units`);
    const units = q.units.map((t) => ({ unit: t.unit, power: t.power / degree }));
    return { kind: 'quantity', value: q.value ** (1 / degree), dims: q.dims.map((d) => d / degree), units };
  };
}

function extreme(name: string, pick: (a: number, b: number) => boolean): Fn {
  return (args) => {
    if (args.length === 0) throw new CalcError(`${name}() needs at least one value`);
    const values = args.map((a) => quantity(a, name));
    for (const v of values) {
      if (!sameDims(v.dims, values[0].dims)) throw new CalcError(`${name}() values must have the same unit type`);
    }
    return values.reduce((best, v) => (pick(v.value, best.value) ? v : best));
  };
}

export const FUNCTIONS: Record<string, Fn> = {
  sin: trig('sin', Math.sin), cos: trig('cos', Math.cos), tan: trig('tan', Math.tan),
  asin: unary('asin', Math.asin), acos: unary('acos', Math.acos), atan: unary('atan', Math.atan),
  sinh: unary('sinh', Math.sinh), cosh: unary('cosh', Math.cosh), tanh: unary('tanh', Math.tanh),
  sqrt: root('sqrt', 2), cbrt: root('cbrt', 3),
  ln: unary('ln', Math.log), log2: unary('log2', Math.log2), log10: unary('log10', Math.log10),
  exp: unary('exp', Math.exp),
  log: (args) => {
    arity('log', args, 1, 2);
    const x = toNumber(args[0], 'log');
    const result = args[1] ? Math.log(x) / Math.log(toNumber(args[1], 'log')) : Math.log10(x);
    if (Number.isNaN(result)) throw new CalcError('log() is undefined for this value');
    return num(result);
  },
  abs: (args) => {
    arity('abs', args, 1);
    const q = quantity(args[0], 'abs');
    return { ...fromDisplay(Math.abs(displayValue(q)), q.units), format: q.format };
  },
  round: rounding('round', Math.round),
  floor: rounding('floor', Math.floor),
  ceil: rounding('ceil', Math.ceil),
  trunc: rounding('trunc', Math.trunc),
  min: extreme('min', (a, b) => a < b),
  max: extreme('max', (a, b) => a > b),
  fromunix: (args) => {
    arity('fromunix', args, 1);
    return date(toNumber(args[0], 'fromunix') * 1000, false);
  },
  sum: (args) => {
    if (args.length === 0) throw new CalcError('sum() needs at least one value');
    return args.reduce((total, v) => add(total, v));
  },
  avg: (args) => {
    if (args.length === 0) throw new CalcError('avg() needs at least one value');
    return divide(args.reduce((total, v) => add(total, v)), num(args.length));
  },
};

export function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) throw new CalcError('Factorial needs a whole number ≥ 0');
  if (n > 170) return Infinity;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}
