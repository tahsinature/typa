/**
 * Numi-style percentage handling:
 *   100 + 10%  → (100) * (1 + 10 / 100)  = 110
 *   100 - 25%  → (100) * (1 - 25 / 100)  = 75
 *   200 * 15%  → (200) * (15 / 100)       = 30
 *   200 / 50%  → (200) / (50 / 100)       = 400
 */
export function transformPercentages(expr: string): string {
  // A +/- N% → (A) * (1 +/- N / 100)
  expr = expr.replace(
    /(.+)\s*([+\-])\s*(\d+(?:\.\d+)?)\s*%/,
    '($1) * (1 $2 $3 / 100)'
  );

  // A * N% → (A) * (N / 100)
  expr = expr.replace(
    /(.+)\s*\*\s*(\d+(?:\.\d+)?)\s*%/,
    '($1) * ($2 / 100)'
  );

  // A / N% → (A) / (N / 100)
  expr = expr.replace(
    /(.+)\s*\/\s*(\d+(?:\.\d+)?)\s*%/,
    '($1) / ($2 / 100)'
  );

  return expr;
}
