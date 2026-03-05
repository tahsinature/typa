export interface LineResult {
  line: number;
  input: string;
  result: string | null;
  error: string | null;
}

export interface EvaluationResult {
  lines: LineResult[];
}

export interface Transform {
  id: string;
  name: string;
  description: string;
  category: string;
  fn: (input: string) => string | Promise<string>;
}
