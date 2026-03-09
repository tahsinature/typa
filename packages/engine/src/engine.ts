import { create, all } from 'mathjs';
import { Scope } from './scope';
import { preprocessLine } from './preprocessor';
import { formatResult, extractNumeric } from './postprocessor';
import { registerCurrencies } from './currency';
import type { LineResult } from './types';

export class TypaEngine {
  private scope = new Scope();
  private math = create(all);
  private rates: Record<string, number> | null = null;

  constructor() {
    this.setupCustomUnits();
  }

  evaluateDocument(text: string): LineResult[] {
    this.scope.reset();
    const lines = text.split('\n');
    return lines.map((raw, i) => this.evaluateLine(raw, i + 1));
  }

  /**
   * Load exchange rates for currency conversion.
   * @param rates — { EUR: 0.92, GBP: 0.79, … } where 1 USD = rates[X]
   */
  setCurrencyRates(rates: Record<string, number>): void {
    this.rates = rates;
    this.math = create(all);
    this.setupCustomUnits();
    registerCurrencies(this.math, rates);
  }

  private setupCustomUnits(): void {
    // CSS units (default: 96 ppi, 1 em = 16 px)
    try { this.math.createUnit('px', `${1 / 96} inch`); } catch {}
    try { this.math.createUnit('pt', `${1 / 72} inch`, { override: true }); } catch {}
    try { this.math.createUnit('em', `${16 / 96} inch`); } catch {}
  }

  private evaluateLine(raw: string, lineNum: number): LineResult {
    const expr = preprocessLine(raw, this.scope);

    if (expr === null) {
      this.scope.addLineResult(null);
      return { line: lineNum, input: raw, result: null, error: null };
    }

    try {
      const value = this.math.evaluate(expr, this.scope.getMathScope());
      const result = formatResult(value);
      this.scope.addLineResult(extractNumeric(value));
      return { line: lineNum, input: raw, result, error: null };
    } catch (e: unknown) {
      this.scope.addLineResult(null);
      const message = e instanceof Error ? e.message : String(e);
      return { line: lineNum, input: raw, result: null, error: message };
    }
  }
}
