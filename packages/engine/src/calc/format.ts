import { SYMBOLS } from './currencies';
import { CURRENCY, sameDims } from './dimensions';
import { type DateValue, type Quantity, type UnitTerm, type Value, displayValue } from './values';

const SUPERSCRIPTS: Record<string, string> = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

/** 12 significant digits with en-US grouping; exponent form for extreme magnitudes. */
export function formatNumber(n: number, maximumFractionDigits?: number): string {
  if (Number.isNaN(n)) return 'NaN';
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '-∞';
  const rounded = parseFloat(n.toPrecision(12));
  const abs = Math.abs(rounded);
  // Compact summaries still need meaningful digits for values below 0.01.
  if (maximumFractionDigits !== undefined && abs > 0 && abs < 10 ** -maximumFractionDigits) {
    const small = Number(rounded.toPrecision(3));
    return Math.abs(small) < 1e-10
      ? formatScientific(small)
      : small.toLocaleString('en-US', { maximumSignificantDigits: 3 });
  }
  if (abs >= 1e21 || (abs !== 0 && abs < 1e-10)) return formatScientific(rounded);
  return rounded.toLocaleString('en-US', { maximumFractionDigits: maximumFractionDigits ?? 10 });
}

function formatScientific(n: number): string {
  const [mantissa, exponent] = parseFloat(n.toPrecision(12)).toExponential().split('e');
  return `${mantissa}e${exponent.replace('+', '')}`;
}

function formatCurrency(n: number, code: string): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: code, currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  const text = formatter.format(n);
  const symbol = formatter.formatToParts(n).find((part) => part.type === 'currency')?.value;
  if (!symbol || !(symbol in SYMBOLS)) {
    return `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${code}`;
  }
  // Keep codes for potentially ambiguous symbols, e.g. $20.00 CAD and ¥20.00 JPY.
  return ['USD', 'EUR', 'GBP'].includes(code) || symbol === code ? text : `${text} ${code}`;
}

function formatInteger(n: number, radix: number, prefix: string): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded).toString(radix);
  return `${sign}${prefix}${radix === 16 ? digits.toUpperCase() : digits}`;
}

function superscript(power: number): string {
  return power === 1 ? '' : [...String(power)].map((c) => SUPERSCRIPTS[c] ?? c).join('');
}

/** "km/h", "m²", "kg·m/s²". */
export function formatUnits(units: UnitTerm[]): string {
  const top = units.filter((t) => t.power > 0).map((t) => t.unit.symbol + superscript(t.power));
  const bottom = units.filter((t) => t.power < 0).map((t) => t.unit.symbol + superscript(-t.power));
  const numerator = top.length ? top.join('·') : '1';
  if (!bottom.length) return numerator;
  return `${numerator}/${bottom.length > 1 ? `(${bottom.join('·')})` : bottom[0]}`;
}

function formatQuantity(q: Quantity, maximumFractionDigits?: number): string {
  const n = displayValue(q);
  let digits: string;
  switch (q.format) {
    case 'hex': digits = formatInteger(n, 16, '0x'); break;
    case 'binary': digits = formatInteger(n, 2, '0b'); break;
    case 'octal': digits = formatInteger(n, 8, '0o'); break;
    case 'scientific': digits = formatScientific(n); break;
    default: {
      const isMoney = q.units.length === 1 && q.units[0].power === 1 && sameDims(q.units[0].unit.dims, CURRENCY);
      if (isMoney) return formatCurrency(n, q.units[0].unit.symbol);
      digits = formatNumber(n, maximumFractionDigits);
    }
  }
  if (!q.units.length) return digits;
  const unit = formatUnits(q.units);
  return unit === '°' ? `${digits}°` : `${digits} ${unit}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

function formatDate(d: DateValue): string {
  const date = new Date(d.ms);
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const midnight = date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0;
  if (d.dateOnly || midnight) return day;
  const hours = date.getHours();
  return `${day}, ${hours % 12 || 12}:${pad(date.getMinutes())} ${hours >= 12 ? 'PM' : 'AM'}`;
}

export function formatValue(v: Value, maximumFractionDigits?: number): string {
  switch (v.kind) {
    case 'percent': return `${formatNumber(v.ratio * 100, maximumFractionDigits)}%`;
    case 'date': return formatDate(v);
    case 'quantity': return formatQuantity(v, maximumFractionDigits);
  }
}
