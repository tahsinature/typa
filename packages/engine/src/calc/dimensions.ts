/**
 * A physical dimension as exponents of base quantities, e.g. speed = length¹·time⁻¹.
 * Index order: length, mass, time, current, temperature, data, currency, angle.
 */
export type Dims = readonly number[];

const BASE_COUNT = 8;

export const NONE: Dims = Array(BASE_COUNT).fill(0);

function base(index: number): Dims {
  return NONE.map((_, i) => (i === index ? 1 : 0));
}

export const LENGTH = base(0);
export const MASS = base(1);
export const TIME = base(2);
export const CURRENT = base(3);
export const TEMPERATURE = base(4);
export const DATA = base(5);
export const CURRENCY = base(6);
export const ANGLE = base(7);

export function mulDims(a: Dims, b: Dims): Dims {
  return a.map((v, i) => v + b[i]);
}

export function divDims(a: Dims, b: Dims): Dims {
  return a.map((v, i) => v - b[i]);
}

export function powDims(a: Dims, power: number): Dims {
  return a.map((v) => v * power);
}

export function sameDims(a: Dims, b: Dims): boolean {
  return a.every((v, i) => v === b[i]);
}

export function isDimensionless(a: Dims): boolean {
  return a.every((v) => v === 0);
}

/** Builds a dimension from base dims and powers, e.g. dims([LENGTH, 1], [TIME, -1]). */
export function dims(...parts: [Dims, number][]): Dims {
  return parts.reduce<Dims>((acc, [d, p]) => mulDims(acc, powDims(d, p)), NONE);
}

export const AREA = dims([LENGTH, 2]);
export const VOLUME = dims([LENGTH, 3]);
export const SPEED = dims([LENGTH, 1], [TIME, -1]);
export const FREQUENCY = dims([TIME, -1]);
export const DATA_RATE = dims([DATA, 1], [TIME, -1]);
export const ENERGY = dims([MASS, 1], [LENGTH, 2], [TIME, -2]);
export const POWER = dims([MASS, 1], [LENGTH, 2], [TIME, -3]);
export const FORCE = dims([MASS, 1], [LENGTH, 1], [TIME, -2]);
export const PRESSURE = dims([MASS, 1], [LENGTH, -1], [TIME, -2]);
export const VOLTAGE = dims([POWER, 1], [CURRENT, -1]);
export const RESISTANCE = dims([VOLTAGE, 1], [CURRENT, -1]);

const NAMED_DIMS: [string, Dims][] = [
  ['length', LENGTH], ['mass', MASS], ['time', TIME], ['current', CURRENT],
  ['temperature', TEMPERATURE], ['data', DATA], ['currency', CURRENCY], ['angle', ANGLE],
  ['area', AREA], ['volume', VOLUME], ['speed', SPEED], ['frequency', FREQUENCY],
  ['data rate', DATA_RATE], ['energy', ENERGY], ['power', POWER], ['force', FORCE],
  ['pressure', PRESSURE], ['voltage', VOLTAGE], ['resistance', RESISTANCE],
];

/** Human name of a dimension for error messages ("length", "speed", or "number"). */
export function describeDims(d: Dims): string {
  if (isDimensionless(d)) return 'number';
  const named = NAMED_DIMS.find(([, nd]) => sameDims(nd, d));
  return named ? named[0] : 'a compound unit';
}
