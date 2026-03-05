export class Scope {
  private mathScope: Record<string, unknown> = {};
  private lineResults: (number | null)[] = [];

  getMathScope(): Record<string, unknown> {
    return this.mathScope;
  }

  addLineResult(value: number | null): void {
    this.lineResults.push(value);
  }

  getLineResult(lineNum: number): number | null {
    return this.lineResults[lineNum - 1] ?? null;
  }

  getPreviousResult(): number | null {
    for (let i = this.lineResults.length - 1; i >= 0; i--) {
      if (this.lineResults[i] !== null) return this.lineResults[i];
    }
    return null;
  }

  getSum(): number {
    return this.lineResults.reduce<number>((sum, v) => sum + (v ?? 0), 0);
  }

  getAvg(): number {
    const values = this.lineResults.filter((v): v is number => v !== null);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  reset(): void {
    this.mathScope = {};
    this.lineResults = [];
  }
}
