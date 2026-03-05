export interface LineResult {
  line: number;
  input: string;
  result: string | null;
  error: string | null;
}

export interface EvaluationResult {
  lines: LineResult[];
}

export interface ViewerRef {
  id: string;
  parse: (output: string) => unknown;
}

export interface Transform {
  id: string;
  name: string;
  description: string;
  category: string;
  inputs?: number;
  fn: (...inputs: string[]) => string | Promise<string>;
  viewers?: ViewerRef[];
  inputWidgets?: string[];
}
