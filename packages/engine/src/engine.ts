import { Calculator, expressionOf, type LineOutcome } from './calc/document';
import { formatValue } from './calc/format';
import { calculatorVocabulary, completionItems, type CalculatorVocabulary, type CompletionItem } from './calc/completions';
import { convert, divide, num, type Value } from './calc/values';
import { CURRENCY, sameDims } from './calc/dimensions';
import type { LineResult } from './types';

export interface SelectionSummary {
  sum: string | null;
  average: string | null;
  count: number;
}

export class TypaEngine {
  private calculator: Calculator;
  private lastOutcomes: LineOutcome[] = [];

  constructor(options: { now?: () => number } = {}) {
    this.calculator = new Calculator(options);
  }

  evaluateDocument(text: string): LineResult[] {
    this.lastOutcomes = this.calculator.evaluate(text);
    return this.lastOutcomes.map(({ line, input, result, error, item, calculation }) => ({ line, input, result, error, item, calculation }));
  }

  /**
   * Load exchange rates for currency conversion.
   * @param rates — { EUR: 0.92, GBP: 0.79, … } where 1 USD = rates[X]
   */
  setCurrencyRates(rates: Record<string, number>): void {
    this.calculator.currencies.setRates(rates);
  }

  /** Summarizes selected 1-based lines, or the whole sheet without standalone aggregate rows. */
  summarize(lines?: number[]): SelectionSummary {
    const outcomes = lines
      ? lines.map((n) => this.lastOutcomes[n - 1]).filter((outcome) => outcome !== undefined)
      : this.lastOutcomes.filter((outcome) => !/^(sum|total|avg|average)$/i.test(expressionOf(outcome.input) ?? ''));
    const values = outcomes
      .map((outcome) => outcome.value)
      .filter((v): v is Value => v != null);
    let { sum, count } = Calculator.sum(values);
    const currencies = new Set(values.flatMap((value) =>
      value.kind === 'quantity' && sameDims(value.dims, CURRENCY) ? value.units.map((term) => term.unit.symbol) : [],
    ));
    if (sum?.kind === 'quantity' && sameDims(sum.dims, CURRENCY) && currencies.size > 1) {
      sum = convert(sum, [this.calculator.findUnit('USD')!]);
    }
    if (!sum) return { sum: null, average: null, count: 0 };
    return { sum: formatValue(sum), average: formatValue(divide(sum, num(count)), 2), count };
  }

  /** Units, currencies, functions, keywords and the variables of the last evaluated document. */
  getCompletions(): CompletionItem[] {
    return completionItems(this.calculator.currencies.codes(), this.calculator.variableNames());
  }

  /** Word lists for syntax highlighting. */
  getVocabulary(): CalculatorVocabulary {
    return calculatorVocabulary(this.calculator.currencies.codes());
  }
}
