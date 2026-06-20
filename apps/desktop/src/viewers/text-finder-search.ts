// Pure search logic for the "Find & Highlight" viewer. No React, no DOM —
// just text in, matches out, so it stays small and easy to reason about.

export interface SearchOptions {
  query: string;
  regex: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
}

export interface Match {
  start: number; // absolute index in the text (inclusive)
  end: number; // absolute index in the text (exclusive)
  line: number; // 0-based line the match starts on
  colStart: number; // offset within that line
  colEnd: number; // offset within that line (clamped per-line by the renderer)
  text: string; // the matched substring
}

export interface SearchResult {
  matches: Match[];
  error: string | null; // invalid-regex message, or null when the pattern is fine
}

// Safety cap so a pathological pattern on a huge clipboard can't lock the UI.
const MAX_MATCHES = 50_000;

const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

function escapeRegExp(value: string): string {
  return value.replace(REGEX_SPECIALS, '\\$&');
}

/** Build the RegExp for a query + its flags. Throws on an invalid pattern. */
export function buildPattern(options: SearchOptions): RegExp {
  let source = options.regex ? options.query : escapeRegExp(options.query);
  if (options.wholeWord) source = `\\b(?:${source})\\b`;
  const flags = `gm${options.caseSensitive ? '' : 'i'}`;
  return new RegExp(source, flags);
}

/** Absolute index → 0-based line, via the line-start offsets table. */
function lineIndexOf(lineStarts: number[], position: number): number {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid] <= position) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function computeLineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10 /* \n */) starts.push(i + 1);
  }
  return starts;
}

/** Find every match of `options` in `text`, in document order. */
export function search(text: string, options: SearchOptions): SearchResult {
  if (!options.query || !text) return { matches: [], error: null };

  let pattern: RegExp;
  try {
    pattern = buildPattern(options);
  } catch (error) {
    return { matches: [], error: (error as Error).message };
  }

  const lineStarts = computeLineStarts(text);
  const matches: Match[] = [];

  let result: RegExpExecArray | null;
  while ((result = pattern.exec(text)) !== null) {
    // Zero-width matches (e.g. `a*`) would loop forever — step past and skip.
    if (result[0].length === 0) {
      pattern.lastIndex += 1;
      continue;
    }

    const start = result.index;
    const end = start + result[0].length;
    const line = lineIndexOf(lineStarts, start);
    matches.push({
      start,
      end,
      line,
      colStart: start - lineStarts[line],
      colEnd: end - lineStarts[line],
      text: result[0],
    });

    if (matches.length >= MAX_MATCHES) break;
  }

  return { matches, error: null };
}

/**
 * Replace matches in `text`. In regex mode the replacement honours native
 * group references like `$1`; in literal mode `$` is treated as a literal.
 */
export function replaceAll(text: string, options: SearchOptions, replacement: string): string {
  if (!options.query || !text) return text;
  const pattern = buildPattern(options);
  const safe = options.regex ? replacement : replacement.replace(/\$/g, '$$$$');
  return text.replace(pattern, safe);
}

/** Replace a single match span with `replacement`, verbatim. */
export function replaceSpan(text: string, match: Match, replacement: string): string {
  return text.slice(0, match.start) + replacement + text.slice(match.end);
}
