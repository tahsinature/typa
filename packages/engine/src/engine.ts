import { Calculator, type LineOutcome } from './calc/document';
import { formatValue } from './calc/format';
import { calculatorVocabulary, completionItems, type CalculatorVocabulary, type CompletionItem } from './calc/completions';
import { divide, num, type Value } from './calc/values';
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
    return this.lastOutcomes.map(({ line, input, result, error }) => ({ line, input, result, error }));
  }

  /**
   * Load exchange rates for currency conversion.
   * @param rates — { EUR: 0.92, GBP: 0.79, … } where 1 USD = rates[X]
   */
  setCurrencyRates(rates: Record<string, number>): void {
    this.calculator.currencies.setRates(rates);
  }

  /** Sum, average and count of the results on the given 1-based lines of the last evaluated document. */
  summarize(lines: number[]): SelectionSummary {
    const values = lines
      .map((n) => this.lastOutcomes[n - 1]?.value)
      .filter((v): v is Value => v != null);
    const { sum, count } = Calculator.sum(values);
    if (!sum) return { sum: null, average: null, count: 0 };
    return { sum: formatValue(sum), average: formatValue(divide(sum, num(count))), count };
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
