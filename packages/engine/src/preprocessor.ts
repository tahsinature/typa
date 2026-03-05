import { Scope } from './scope';
import { transformPercentages } from './percentage';

/**
 * Preprocesses a line before math.js evaluation.
 * Returns null if the line should be skipped (comments, empty).
 */
export function preprocessLine(raw: string, scope: Scope): string | null {
  const trimmed = raw.trim();

  // Skip empty lines and comments
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) {
    return null;
  }

  let expr = trimmed;

  // Resolve lineN references (e.g., line1, line2)
  expr = expr.replace(/\bline(\d+)\b/gi, (_match, num) => {
    const val = scope.getLineResult(parseInt(num));
    return val !== null ? String(val) : '0';
  });

  // Resolve prev
  expr = expr.replace(/\bprev\b/gi, () => {
    const val = scope.getPreviousResult();
    return val !== null ? String(val) : '0';
  });

  // Resolve sum and avg aggregates
  expr = expr.replace(/\bsum\b/gi, () => String(scope.getSum()));
  expr = expr.replace(/\bavg\b/gi, () => String(scope.getAvg()));

  // Numi-style percentages
  expr = transformPercentages(expr);

  // Normalize "in" to "to" for unit conversions (e.g., "5 kg in lb")
  expr = expr.replace(/\bin\b/g, 'to');

  return expr;
}
