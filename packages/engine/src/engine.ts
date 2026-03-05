import { create, all } from 'mathjs';
import { Scope } from './scope';
import { preprocessLine } from './preprocessor';
import { formatResult, extractNumeric } from './postprocessor';
import type { LineResult } from './types';

const math = create(all);

export class TypaEngine {
  private scope = new Scope();

  evaluateDocument(text: string): LineResult[] {
    this.scope.reset();
    const lines = text.split('\n');
    return lines.map((raw, i) => this.evaluateLine(raw, i + 1));
  }

  private evaluateLine(raw: string, lineNum: number): LineResult {
    const expr = preprocessLine(raw, this.scope);

    if (expr === null) {
      this.scope.addLineResult(null);
      return { line: lineNum, input: raw, result: null, error: null };
    }

    try {
      const value = math.evaluate(expr, this.scope.getMathScope());
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
