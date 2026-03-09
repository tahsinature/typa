import { CURRENCY_CODES } from './currency';

// Timestamps between year 2000 and 2100 (in seconds)
const TS_MIN = 946684800;
const TS_MAX = 4102444800;

/**
 * Formats a math.js result into a display string.
 * Returns null if the result should not be displayed.
 */
export function formatResult(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'function') return null;

  // math.js ResultSet (from multi-expression lines) — skip
  if (typeof value === 'object' && value !== null && 'entries' in value) {
    return null;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return String(value);
    if (Number.isInteger(value)) return value.toLocaleString('en-US');
    return parseFloat(value.toPrecision(12)).toLocaleString('en-US', {
      maximumFractionDigits: 10,
    });
  }

  if (typeof value === 'string') return value;

  // math.js objects (units, matrices, etc.)
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    // Try to detect timestamps (time units with large values)
    if ('toNumber' in value && typeof (value as any).toNumber === 'function') {
      try {
        const seconds = (value as any).toNumber('s');
        if (seconds > TS_MIN && seconds < TS_MAX) {
          return formatDateTime(new Date(seconds * 1000));
        }
      } catch {
        // not a time unit — continue
      }
    }

    const str = (value as { toString: () => string }).toString();

    // Format currency units with 2 decimal places
    const match = str.match(/^(-?[\d.]+(?:e[+-]?\d+)?)\s+(.+)$/);
    if (match) {
      const [, numStr, unit] = match;
      if (CURRENCY_CODES.has(unit)) {
        const num = parseFloat(numStr);
        if (!isNaN(num)) {
          return `${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit}`;
        }
      }
    }

    return str;
  }

  return String(value);
}

function formatDateTime(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');

  const h24 = date.getHours();
  const min = date.getMinutes();

  // If exactly midnight, show date only
  if (h24 === 0 && min === 0 && date.getSeconds() === 0) {
    return `${y}-${mo}-${d}`;
  }

  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  const mm = String(min).padStart(2, '0');
  return `${y}-${mo}-${d}, ${h12}:${mm} ${ampm}`;
}

/**
 * Extracts a numeric value from a math.js result for scope tracking.
 */
export function extractNumeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  // math.js Unit — try to get the numeric value
  if (
    typeof value === 'object' &&
    value !== null &&
    'toNumber' in value &&
    typeof (value as { toNumber: unknown }).toNumber === 'function'
  ) {
    try {
      return (value as { toNumber: () => number }).toNumber();
    } catch {
      return null;
    }
  }

  return null;
}
