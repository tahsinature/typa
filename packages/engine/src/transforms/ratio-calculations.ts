export function format(value: number): string {
  if (!Number.isFinite(value)) throw new Error("The result is too large. Use smaller values.");
  return String(Number(value.toPrecision(12)));
}

export function readNumber(input: string): number {
  if (!/^\d+(?:\.\d{1,6})?$/.test(input.trim())) {
    throw new Error("Use non-negative numbers with up to six decimal places.");
  }
  const value = Number(input);
  if (!Number.isSafeInteger(Math.round(value * 1_000_000))) {
    throw new Error("The value is too large. Use smaller numbers.");
  }
  return value;
}

export function readRatio(input: string): number[] {
  const parts = input.trim().split(/\s*[:x×]\s*/i);
  if (parts.length < 2) throw new Error("Enter at least two values separated by : or ×.");
  const units = new Set<string>();
  const values = parts.map((part) => {
    const match = part.match(/^(\d+(?:\.\d{1,6})?)\s*(mm|cm|m|in|px|pt)?$/i);
    if (!match) throw new Error("Enter numbers such as 35:45 or 35 mm × 45 mm.");
    if (match[2]) units.add(match[2].toLowerCase());
    return readNumber(match[1]);
  });
  if (units.size > 1) throw new Error("Convert all values to the same unit first.");
  if (values.every((value) => value === 0)) throw new Error("At least one ratio value must be greater than zero.");
  return values;
}

function gcd(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

export function simplify(values: number[]): string {
  const decimalPlaces = Math.max(
    ...values.map((value) => {
      // Fixed notation also handles small values represented with an exponent.
      return value.toFixed(6).replace(/0+$/, "").split(".")[1]?.length ?? 0;
    }),
  );
  const integers = values.map((value) => Math.round(value * 10 ** decimalPlaces));
  const divisor = integers.reduce(gcd);
  return integers.map((value) => value / divisor).join(":");
}

export function proportionValue(values: number[], missing: number): number {
  const [a, b, c, d] = values;
  switch (missing) {
    case 0:
      return b * (c / d);
    case 1:
      return a * (d / c);
    case 2:
      return d * (a / b);
    default:
      return c * (b / a);
  }
}
