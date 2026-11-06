import { currencyNames } from './currencies';
import { CONSTANTS, FUNCTIONS } from './functions';
import { keywordSpellings } from './parser';
import { ALL_UNITS, unitSpellings } from './units';

export type CompletionKind = 'unit' | 'currency' | 'function' | 'constant' | 'keyword' | 'variable';

export interface CompletionItem {
  label: string;
  kind: CompletionKind;
  /** Short description shown next to the label. */
  detail: string;
  /** Text to insert, when it differs from the label. */
  insertText?: string;
  /** Text matched against what the user types, when it differs from the label. */
  filterText?: string;
}

const KEYWORDS: [string, string][] = [
  ['to', 'convert'], ['in', 'convert'], ['as', 'convert'], ['of', '20% of 50'], ['on', '5% on 30'],
  ['off', '10% off 80'], ['per', 'rate'], ['prev', 'previous result'], ['sum', 'sum of the block above'],
  ['total', 'sum of the block above'], ['avg', 'average of the block above'], ['now', 'current time'],
  ['today', 'date'], ['tomorrow', 'date'], ['yesterday', 'date'], ['hex', 'format'], ['binary', 'format'],
  ['octal', 'format'], ['sci', 'scientific format'],
];

const FUNCTION_SIGNATURES: Record<string, string> = {
  round: 'round(x, digits)', floor: 'floor(x, digits)', ceil: 'ceil(x, digits)', trunc: 'trunc(x, digits)',
  log: 'log(x, base)', min: 'min(a, b, …)', max: 'max(a, b, …)', sum: 'sum(a, b, …)', avg: 'avg(a, b, …)',
  fromunix: 'fromunix(seconds)',
};

function staticItems(): CompletionItem[] {
  const seen = new Set<string>();
  const items: CompletionItem[] = [];
  const push = (item: CompletionItem) => {
    if (seen.has(item.label)) return;
    seen.add(item.label);
    items.push(item);
  };
  for (const unit of ALL_UNITS) {
    if (/^[\w°µΩÅ/]+$/u.test(unit.symbol)) push({ label: unit.symbol, kind: 'unit', detail: unit.label, filterText: `${unit.symbol} ${unit.label}` });
  }
  for (const name of Object.keys(FUNCTIONS)) {
    push({ label: name, kind: 'function', detail: FUNCTION_SIGNATURES[name] ?? `${name}(x)`, insertText: `${name}(` });
  }
  for (const name of Object.keys(CONSTANTS)) push({ label: name, kind: 'constant', detail: String(CONSTANTS[name].toFixed(6)) });
  for (const [label, detail] of KEYWORDS) push({ label, kind: 'keyword', detail });
  for (const name of currencyNames()) push({ label: name, kind: 'currency', detail: 'currency' });
  return items;
}

let cachedStatic: CompletionItem[] | null = null;

export interface CalculatorVocabulary {
  units: string[];
  currencies: string[];
  functions: string[];
  constants: string[];
  keywords: string[];
}

/** Word lists for syntax highlighting; currency codes come from the loaded rates. */
export function calculatorVocabulary(currencyCodes: string[]): CalculatorVocabulary {
  return {
    units: unitSpellings(),
    currencies: [...currencyCodes, ...currencyNames()],
    functions: Object.keys(FUNCTIONS),
    constants: Object.keys(CONSTANTS),
    keywords: [...keywordSpellings(), 'prev', 'sum', 'total', 'avg', 'average', 'now', 'today', 'tomorrow', 'yesterday'],
  };
}

export function completionItems(currencyCodes: string[], variables: string[]): CompletionItem[] {
  cachedStatic ??= staticItems();
  return [
    ...variables.map((name): CompletionItem => ({ label: name, kind: 'variable', detail: 'variable' })),
    ...currencyCodes.map((code): CompletionItem => ({ label: code, kind: 'currency', detail: 'currency' })),
    ...cachedStatic,
  ];
}
