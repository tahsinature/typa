import { Scope } from './scope';
import { transformPercentages } from './percentage';
import { CURRENCY_CODES, CURRENCY_NAMES } from './currency';

// Pre-compile currency code regex (case-insensitive → uppercase)
const currencyCodeRegex = new RegExp(
  `\\b(${[...CURRENCY_CODES].join('|')})\\b`,
  'gi',
);

// Pre-compile currency name → code regex
const currencyNameEntries = Object.entries(CURRENCY_NAMES);
const currencyNameRegex = new RegExp(
  `\\b(${currencyNameEntries.map(([n]) => n).join('|')})\\b`,
  'gi',
);
const currencyNameMap = new Map(
  currencyNameEntries.map(([n, c]) => [n.toLowerCase(), c]),
);

// Scale suffix regex (case-sensitive: k=thousands, M=millions)
const scaleRegex = /(\d+(?:\.\d+)?)\s*(?:(k)\b|(M)\b|(thousand)s?\b|(million)s?\b|(billion)s?\b)/g;

/**
 * Preprocesses a line before math.js evaluation.
 * Returns null if the line should be skipped (comments, empty).
 */
export function preprocessLine(raw: string, scope: Scope): string | null {
  const trimmed = raw.trim();

  // Skip empty lines, comments, headers
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) {
    return null;
  }

  let expr = trimmed;

  // Labels: "Price: $11 + $34" → "$11 + $34"
  // Require space after colon to avoid matching time like "2:30"
  const labelMatch = expr.match(/^[A-Za-z][\w\s]*?:\s+(.+)$/);
  if (labelMatch) expr = labelMatch[1];

  // Strip inline comments (double-quoted strings)
  expr = expr.replace(/"[^"]*"/g, '').trim();
  if (!expr) return null;

  // Scales (before currency symbols so $2k → $2000 → 2000 USD)
  expr = expr.replace(scaleRegex, (_, n, k, M, thou, mil, bil) => {
    const num = parseFloat(n);
    if (k) return String(num * 1e3);
    if (M) return String(num * 1e6);
    if (thou) return String(num * 1e3);
    if (mil) return String(num * 1e6);
    if (bil) return String(num * 1e9);
    return _;
  });

  // Currency symbols → codes
  expr = expr.replace(/\$\s*(\d+(?:\.\d+)?)/g, '$1 USD');
  expr = expr.replace(/€\s*(\d+(?:\.\d+)?)/g, '$1 EUR');
  expr = expr.replace(/£\s*(\d+(?:\.\d+)?)/g, '$1 GBP');
  expr = expr.replace(/¥\s*(\d+(?:\.\d+)?)/g, '$1 JPY');

  // Date keywords → Unix timestamp in seconds (as math.js time Unit)
  const midnight = () => Math.floor(new Date(new Date().setHours(0, 0, 0, 0)).getTime() / 1000);
  expr = expr.replace(/\bnow\b/gi, () => `${Math.floor(Date.now() / 1000)} second`);
  expr = expr.replace(/\btoday\b/gi, () => `${midnight()} second`);
  expr = expr.replace(/\btomorrow\b/gi, () => `${midnight() + 86400} second`);
  expr = expr.replace(/\byesterday\b/gi, () => `${midnight() - 86400} second`);

  // fromunix(N) → N second
  expr = expr.replace(/\bfromunix\s*\(([^)]+)\)/gi, '($1) second');

  // Track percentage variable assignments (v2 = 5%)
  const assignMatch = expr.match(/^(\w+)\s*=/);
  const assignedVar = assignMatch ? assignMatch[1] : null;
  const pctAssign = expr.match(/^(\w+)\s*=\s*(\d+(?:\.\d+)?)\s*%\s*$/);
  if (pctAssign) {
    scope.setPercentVar(pctAssign[1], pctAssign[2]);
  } else if (assignedVar) {
    scope.removePercentVar(assignedVar);
  }

  // Substitute percentage variables on non-assignment lines
  // e.g., "v times 7 - v2" → "v times 7 - 5%" (when v2 was assigned 5%)
  for (const [name, pct] of scope.getPercentVars()) {
    if (name === assignedVar) continue;
    expr = expr.replace(new RegExp(`\\b${name}\\b`, 'g'), `${pct}%`);
  }

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

  // Resolve sum/total and avg/average aggregates
  expr = expr.replace(/\b(?:sum|total)\b/gi, () => String(scope.getSum()));
  expr = expr.replace(/\b(?:avg|average)\b/gi, () => String(scope.getAvg()));

  // ── Percentage patterns (complex → simple, order matters) ──

  // "N% of what is X" → "(X) / (N / 100)"
  expr = expr.replace(
    /^(\d+(?:\.\d+)?)\s*%\s+of\s+what\s+is\s+(.+)$/i,
    '($2) / ($1 / 100)',
  );
  // "N% on what is X" → "(X) / (1 + N / 100)"
  expr = expr.replace(
    /^(\d+(?:\.\d+)?)\s*%\s+on\s+what\s+is\s+(.+)$/i,
    '($2) / (1 + $1 / 100)',
  );
  // "N% off what is X" → "(X) / (1 - N / 100)"
  expr = expr.replace(
    /^(\d+(?:\.\d+)?)\s*%\s+off\s+what\s+is\s+(.+)$/i,
    '($2) / (1 - $1 / 100)',
  );

  // "X as a % of Y" → "(X) / (Y) * 100"
  expr = expr.replace(
    /^(.+?)\s+as\s+(?:a\s+)?%\s+of\s+(.+)$/i,
    '($1) / ($2) * 100',
  );
  // "X as a % on Y" → "((X) - (Y)) / (Y) * 100"
  expr = expr.replace(
    /^(.+?)\s+as\s+(?:a\s+)?%\s+on\s+(.+)$/i,
    '(($1) - ($2)) / ($2) * 100',
  );
  // "X as a % off Y" → "((Y) - (X)) / (Y) * 100"
  expr = expr.replace(
    /^(.+?)\s+as\s+(?:a\s+)?%\s+off\s+(.+)$/i,
    '(($2) - ($1)) / ($2) * 100',
  );

  // "N% of X" → "(X) * (N / 100)"
  expr = expr.replace(
    /^(\d+(?:\.\d+)?)\s*%\s+of\s+(.+)$/i,
    '($2) * ($1 / 100)',
  );
  // "N% on X" → "(X) * (1 + N / 100)"
  expr = expr.replace(
    /^(\d+(?:\.\d+)?)\s*%\s+on\s+(.+)$/i,
    '($2) * (1 + $1 / 100)',
  );
  // "N% off X" → "(X) * (1 - N / 100)"
  expr = expr.replace(
    /^(\d+(?:\.\d+)?)\s*%\s+off\s+(.+)$/i,
    '($2) * (1 - $1 / 100)',
  );

  // Natural language: fractions & multiples
  expr = expr.replace(/^half\s+of\s+(.+)$/i, '($1) / 2');
  expr = expr.replace(/^quarter\s+of\s+(.+)$/i, '($1) / 4');
  expr = expr.replace(/^third\s+of\s+(.+)$/i, '($1) / 3');
  expr = expr.replace(/^double\s+(.+)$/i, '($1) * 2');
  expr = expr.replace(/^triple\s+(.+)$/i, '($1) * 3');

  // Word operators (multi-word first, then single-word)
  expr = expr.replace(/\bmultiplied\s+by\b/gi, '*');
  expr = expr.replace(/\bdivided?\s+by\b/gi, '/');
  expr = expr.replace(/\btimes\b/gi, '*');
  expr = expr.replace(/\bdivide\b/gi, '/');
  expr = expr.replace(/\bplus\b/gi, '+');
  expr = expr.replace(/\bminus\b/gi, '-');
  expr = expr.replace(/\bsubtract\b/gi, '-');
  expr = expr.replace(/\band\b/gi, '+');
  expr = expr.replace(/\bwith\b/gi, '+');
  expr = expr.replace(/\bwithout\b/gi, '-');
  expr = expr.replace(/\bmul\b/gi, '*');

  // Numi-style percentage arithmetic (100 + 10%, 200 * 15%)
  expr = transformPercentages(expr);

  // Area/volume prefixes: "sq cm" → "cm^2", "cubic m" → "m^3"
  expr = expr.replace(/\b(?:sq|square)\s+(\w+)/gi, '$1^2');
  expr = expr.replace(/\b(?:cubic|cu|cb)\s+(\w+)/gi, '$1^3');
  expr = expr.replace(/\bsqm\b/gi, 'm^2');
  expr = expr.replace(/\bsqft\b/gi, 'foot^2');
  expr = expr.replace(/\bsqin\b/gi, 'inch^2');
  expr = expr.replace(/\bcbm\b/gi, 'm^3');

  // Unit aliases
  expr = applyUnitAliases(expr);

  // Degree sign → deg
  expr = expr.replace(/°/g, ' deg');

  // Normalize "in" to "to" for unit conversions
  expr = expr.replace(/\bin\b/g, 'to');

  return expr;
}

function applyUnitAliases(expr: string): string {
  // Data units (case normalization)
  expr = expr.replace(/\bKB\b/g, 'kB');
  expr = expr.replace(/\bkb\b/g, 'kB');

  // Currency names → codes (before code normalization)
  expr = expr.replace(currencyNameRegex, (match) => {
    return currencyNameMap.get(match.toLowerCase()) ?? match;
  });

  // Currency codes → uppercase
  expr = expr.replace(currencyCodeRegex, (match) => match.toUpperCase());

  return expr;
}
