import {
  type Dims, LENGTH, MASS, TIME, CURRENT, TEMPERATURE, DATA, ANGLE,
  AREA, VOLUME, SPEED, FREQUENCY, DATA_RATE, ENERGY, POWER, FORCE, PRESSURE, VOLTAGE, RESISTANCE,
  sameDims,
} from './dimensions';

export interface UnitDef {
  /** Shown in results, e.g. "km" or "°C". */
  symbol: string;
  dims: Dims;
  /** Multiplier to the SI base unit. */
  factor: number;
  /** Added before scaling, only for temperatures (°C → K). */
  offset?: number;
  /** Units that simplify together after × and ÷ (V × A → W). */
  electrical?: boolean;
  /** Long name for autocomplete. */
  label: string;
}

interface Prefix { symbol: string; name: string; factor: number; extraSymbols?: string[] }

const P: Record<string, Prefix> = {
  P: { symbol: 'P', name: 'peta', factor: 1e15 },
  T: { symbol: 'T', name: 'tera', factor: 1e12 },
  G: { symbol: 'G', name: 'giga', factor: 1e9 },
  M: { symbol: 'M', name: 'mega', factor: 1e6 },
  k: { symbol: 'k', name: 'kilo', factor: 1e3 },
  h: { symbol: 'h', name: 'hecto', factor: 1e2 },
  d: { symbol: 'd', name: 'deci', factor: 1e-1 },
  c: { symbol: 'c', name: 'centi', factor: 1e-2 },
  m: { symbol: 'm', name: 'milli', factor: 1e-3 },
  µ: { symbol: 'µ', name: 'micro', factor: 1e-6, extraSymbols: ['u', 'μ'] },
  n: { symbol: 'n', name: 'nano', factor: 1e-9 },
};
const BINARY: Prefix[] = [
  { symbol: 'Ki', name: 'kibi', factor: 1024 },
  { symbol: 'Mi', name: 'mebi', factor: 1024 ** 2 },
  { symbol: 'Gi', name: 'gibi', factor: 1024 ** 3 },
  { symbol: 'Ti', name: 'tebi', factor: 1024 ** 4 },
];

interface Spec {
  symbol: string;
  /** Extra case-sensitive spellings. */
  symbols?: string[];
  /** Case-insensitive long names; plural "s" is added automatically. */
  names: string[];
  dims: Dims;
  factor: number;
  offset?: number;
  electrical?: boolean;
  prefixes?: Prefix[];
}

const INCH = 0.0254;
const LITER = 1e-3;
const GALLON = 3.785411784e-3;
const DAY = 86400;
const YEAR = 365.2425 * DAY;
const POUND = 0.45359237;
const CALORIE = 4.184;

const pick = (...keys: string[]) => keys.map((k) => P[k]);

const SPECS: Spec[] = [
  // Length
  { symbol: 'm', names: ['meter', 'metre'], dims: LENGTH, factor: 1, prefixes: pick('k', 'c', 'm', 'µ', 'n', 'd') },
  { symbol: 'inch', symbols: ['″'], names: ['inch', 'inches'], dims: LENGTH, factor: INCH },
  { symbol: 'ft', symbols: ['′'], names: ['foot', 'feet'], dims: LENGTH, factor: 12 * INCH },
  { symbol: 'yd', names: ['yard'], dims: LENGTH, factor: 36 * INCH },
  { symbol: 'mi', names: ['mile'], dims: LENGTH, factor: 1609.344 },
  { symbol: 'nmi', names: ['nautical mile', 'nauticalmile'], dims: LENGTH, factor: 1852 },
  { symbol: 'au', names: ['astronomical unit'], dims: LENGTH, factor: 149597870700 },
  { symbol: 'ly', names: ['lightyear', 'light-year', 'light year'], dims: LENGTH, factor: 9460730472580800 },
  { symbol: 'Å', names: ['angstrom'], dims: LENGTH, factor: 1e-10 },
  { symbol: 'px', names: ['pixel'], dims: LENGTH, factor: INCH / 96 },
  { symbol: 'pt', names: ['point'], dims: LENGTH, factor: INCH / 72 },
  { symbol: 'em', names: [], dims: LENGTH, factor: (16 * INCH) / 96 },
  { symbol: 'rem', names: [], dims: LENGTH, factor: (16 * INCH) / 96 },

  // Mass
  { symbol: 'g', names: ['gram', 'gramme'], dims: MASS, factor: 1e-3, prefixes: pick('k', 'm', 'µ') },
  { symbol: 't', names: ['tonne', 'metric ton'], dims: MASS, factor: 1000 },
  { symbol: 'ton', names: ['ton', 'short ton'], dims: MASS, factor: 2000 * POUND },
  { symbol: 'lb', symbols: ['lbs'], names: ['pound'], dims: MASS, factor: POUND },
  { symbol: 'oz', names: ['ounce'], dims: MASS, factor: POUND / 16 },
  { symbol: 'st', names: ['stone'], dims: MASS, factor: 14 * POUND },
  { symbol: 'ct', names: ['carat'], dims: MASS, factor: 2e-4 },

  // Time
  { symbol: 's', symbols: ['sec', 'secs'], names: ['second'], dims: TIME, factor: 1, prefixes: pick('m', 'µ', 'n') },
  { symbol: 'min', symbols: ['mins'], names: ['minute'], dims: TIME, factor: 60 },
  { symbol: 'h', symbols: ['hr', 'hrs'], names: ['hour'], dims: TIME, factor: 3600 },
  { symbol: 'd', names: ['day'], dims: TIME, factor: DAY },
  { symbol: 'wk', symbols: ['wks'], names: ['week'], dims: TIME, factor: 7 * DAY },
  { symbol: 'mo', names: ['month'], dims: TIME, factor: YEAR / 12 },
  { symbol: 'yr', symbols: ['yrs'], names: ['year'], dims: TIME, factor: YEAR },
  { symbol: 'decade', names: ['decade'], dims: TIME, factor: 10 * YEAR },
  { symbol: 'century', names: ['century', 'centuries'], dims: TIME, factor: 100 * YEAR },

  // Area and volume (powers like m², sq ft and cubic cm are handled by the parser)
  { symbol: 'ha', names: ['hectare'], dims: AREA, factor: 1e4 },
  { symbol: 'acre', names: ['acre'], dims: AREA, factor: 4046.8564224 },
  { symbol: 'L', symbols: ['l'], names: ['liter', 'litre'], dims: VOLUME, factor: LITER, prefixes: pick('m', 'c', 'd') },
  { symbol: 'cc', names: [], dims: VOLUME, factor: 1e-6 },
  { symbol: 'gal', names: ['gallon'], dims: VOLUME, factor: GALLON },
  { symbol: 'qt', names: ['quart'], dims: VOLUME, factor: GALLON / 4 },
  { symbol: 'pint', names: ['pint'], dims: VOLUME, factor: GALLON / 8 },
  { symbol: 'cup', names: ['cup'], dims: VOLUME, factor: GALLON / 16 },
  { symbol: 'fl oz', symbols: ['floz'], names: ['fluid ounce'], dims: VOLUME, factor: GALLON / 128 },
  { symbol: 'tbsp', names: ['tablespoon'], dims: VOLUME, factor: GALLON / 256 },
  { symbol: 'tsp', names: ['teaspoon'], dims: VOLUME, factor: GALLON / 768 },

  // Speed
  { symbol: 'km/h', symbols: ['kph', 'kmh', 'kmph'], names: [], dims: SPEED, factor: 1000 / 3600 },
  { symbol: 'mph', names: [], dims: SPEED, factor: 1609.344 / 3600 },
  { symbol: 'kn', names: ['knot'], dims: SPEED, factor: 1852 / 3600 },

  // Temperature
  { symbol: 'K', names: ['kelvin'], dims: TEMPERATURE, factor: 1, offset: 0 },
  { symbol: '°C', symbols: ['C', 'degC'], names: ['celsius', 'centigrade', 'degree celsius', 'degrees celsius'], dims: TEMPERATURE, factor: 1, offset: 273.15 },
  { symbol: '°F', symbols: ['F', 'degF'], names: ['fahrenheit', 'degree fahrenheit', 'degrees fahrenheit'], dims: TEMPERATURE, factor: 5 / 9, offset: 459.67 },

  // Data (bytes first so lowercase "mb" means megabyte)
  { symbol: 'B', names: ['byte'], dims: DATA, factor: 8, prefixes: [...pick('k', 'M', 'G', 'T', 'P'), ...BINARY] },
  { symbol: 'bit', symbols: ['b'], names: ['bit'], dims: DATA, factor: 1, prefixes: pick('k', 'M', 'G', 'T') },
  { symbol: 'bps', names: [], dims: DATA_RATE, factor: 1, prefixes: pick('k', 'M', 'G') },

  // Energy and power
  { symbol: 'J', names: ['joule'], dims: ENERGY, factor: 1, prefixes: pick('k', 'M') },
  { symbol: 'cal', names: ['calorie'], dims: ENERGY, factor: CALORIE, prefixes: pick('k') },
  { symbol: 'Wh', names: ['watt hour', 'watthour'], dims: ENERGY, factor: 3600, electrical: true, prefixes: pick('k', 'M', 'G') },
  { symbol: 'eV', names: ['electronvolt'], dims: ENERGY, factor: 1.602176634e-19, prefixes: pick('k', 'M') },
  { symbol: 'BTU', names: [], dims: ENERGY, factor: 1055.06 },
  { symbol: 'W', names: ['watt'], dims: POWER, factor: 1, electrical: true, prefixes: pick('k', 'M', 'G', 'm') },
  { symbol: 'hp', names: ['horsepower'], dims: POWER, factor: 745.69987158227 },

  // Electrical
  { symbol: 'V', names: ['volt'], dims: VOLTAGE, factor: 1, electrical: true, prefixes: pick('k', 'm') },
  { symbol: 'A', names: ['amp', 'ampere'], dims: CURRENT, factor: 1, electrical: true, prefixes: pick('m') },
  { symbol: 'Ω', symbols: ['ohm', 'ohms'], names: ['ohm'], dims: RESISTANCE, factor: 1, electrical: true, prefixes: pick('k', 'M') },

  // Frequency, pressure, force
  { symbol: 'Hz', names: ['hertz'], dims: FREQUENCY, factor: 1, prefixes: pick('k', 'M', 'G') },
  { symbol: 'Pa', names: ['pascal'], dims: PRESSURE, factor: 1, prefixes: pick('h', 'k', 'M') },
  { symbol: 'bar', names: ['bar'], dims: PRESSURE, factor: 1e5, prefixes: pick('m') },
  { symbol: 'atm', names: ['atmosphere'], dims: PRESSURE, factor: 101325 },
  { symbol: 'psi', names: [], dims: PRESSURE, factor: 6894.757293168 },
  { symbol: 'mmHg', names: ['torr'], dims: PRESSURE, factor: 133.322387415 },
  { symbol: 'N', names: ['newton'], dims: FORCE, factor: 1, prefixes: pick('k') },

  // Angle
  { symbol: '°', symbols: ['deg'], names: ['degree'], dims: ANGLE, factor: Math.PI / 180 },
  { symbol: 'rad', names: ['radian'], dims: ANGLE, factor: 1 },
];

export const ALL_UNITS: UnitDef[] = [];
const bySymbol = new Map<string, UnitDef>();
const byName = new Map<string, UnitDef>();

function plural(name: string): string[] {
  return /s$/.test(name) ? [name] : [name, `${name}s`];
}

function register(unit: UnitDef, symbols: string[], names: string[]): void {
  ALL_UNITS.push(unit);
  for (const s of symbols) if (!bySymbol.has(s)) bySymbol.set(s, unit);
  // Lowercase symbol fallbacks ("kwh", "mhz") are only used when no exact symbol matches.
  for (const s of symbols) {
    const lower = s.toLowerCase();
    if (s.length > 1 && !byName.has(lower)) byName.set(lower, unit);
  }
  for (const n of names.flatMap(plural)) {
    const lower = n.toLowerCase();
    if (!byName.has(lower)) byName.set(lower, unit);
  }
}

for (const spec of SPECS) {
  const base: UnitDef = {
    symbol: spec.symbol, dims: spec.dims, factor: spec.factor, offset: spec.offset,
    electrical: spec.electrical, label: spec.names[0] ?? spec.symbol,
  };
  register(base, [spec.symbol, ...(spec.symbols ?? [])], spec.names);
  for (const prefix of spec.prefixes ?? []) {
    const unit: UnitDef = {
      ...base,
      symbol: prefix.symbol + spec.symbol,
      factor: spec.factor * prefix.factor,
      label: spec.names[0] ? prefix.name + spec.names[0] : prefix.symbol + spec.symbol,
    };
    const symbols = [prefix.symbol, ...(prefix.extraSymbols ?? [])].flatMap((ps) =>
      [spec.symbol, ...(spec.symbols ?? [])].map((s) => ps + s),
    );
    register(unit, symbols, spec.names.map((n) => prefix.name + n));
  }
}

// Data-size spellings people actually type: "KB" and "kb" mean kilobyte, "Kb" means kilobit.
bySymbol.set('KB', bySymbol.get('kB')!);
for (const p of ['k', 'M', 'G', 'T']) {
  bySymbol.set(`${p.toUpperCase()}b`, bySymbol.get(`${p}bit`)!);
  bySymbol.set(`${p.toLowerCase()}b`, bySymbol.get(`${p}B`)!);
}

/** Every spelling the unit table understands, for syntax highlighting. */
export function unitSpellings(): string[] {
  return [...bySymbol.keys(), ...byName.keys()];
}

export function findUnit(token: string): UnitDef | undefined {
  return bySymbol.get(token) ?? byName.get(token.toLowerCase());
}

/** Looks up a unit spelling, including powers like "m2", "km²", "sqft" and "cbm". */
export function resolveUnit(token: string): { unit: UnitDef; power: number } | undefined {
  const direct = findUnit(token);
  if (direct) return { unit: direct, power: 1 };

  const powered = token.match(/^(.+?)(\^?[23²³])$/);
  if (powered) {
    const unit = findUnit(powered[1]);
    const power = /[2²]/.test(powered[2]) ? 2 : 3;
    if (unit && sameDims(unit.dims, LENGTH)) return { unit, power };
  }

  const squared = token.match(/^sq(.+)$/i);
  if (squared) {
    const unit = findUnit(squared[1]);
    if (unit && sameDims(unit.dims, LENGTH)) return { unit, power: 2 };
  }
  if (token.toLowerCase() === 'cbm') return { unit: bySymbol.get('m')!, power: 3 };
  return undefined;
}

/** Unit used to name compound results, e.g. W for V × A or N for kg·m/s². */
export function namedUnitFor(d: Dims): UnitDef | undefined {
  return ['W', 'V', 'A', 'Ω', 'N', 'J', 'Pa'].map((s) => bySymbol.get(s)!).find((u) => sameDims(u.dims, d));
}

/** The "watt-hour" unit matching a power unit, e.g. kW → kWh. */
export function hourUnitFor(power: UnitDef): UnitDef | undefined {
  return bySymbol.get(`${power.symbol}h`);
}
