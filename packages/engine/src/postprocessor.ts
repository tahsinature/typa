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
    return (value as { toString: () => string }).toString();
  }

  return String(value);
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
