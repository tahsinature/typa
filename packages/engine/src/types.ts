export interface LineResult {
  line: number;
  input: string;
  result: string | null;
  error: string | null;
}

export interface EvaluationResult {
  lines: LineResult[];
}

/* ── Categories ── */

export const TRANSFORM_CATEGORIES = [
  'Math', 'JSON', 'Hashing', 'Encoding', 'Formatting',
  'Numbers', 'Web', 'Diff', 'Image', 'Diagram', 'Text', 'System',
] as const;

export type TransformCategory = (typeof TRANSFORM_CATEGORIES)[number];

export interface CategoryMeta {
  color: string;
  gradient: [string, string];
  iconPath: string;
}

export const CATEGORY_META: Record<TransformCategory, CategoryMeta> = {
  Math:       { color: "#f59e0b", gradient: ["#f59e0b", "#d97706"], iconPath: "M4 4h6v6H4zM14 4h6v2h-6zM14 8h6v2h-6zM4 16l3-6 3 6M5 14.5h4M14 14l6 6M20 14l-6 6" },
  JSON:       { color: "#4d9fff", gradient: ["#4d9fff", "#2563eb"], iconPath: "M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2 2 2 0 0 0-2 2v5a2 2 0 0 1-2 2h-1" },
  Hashing:    { color: "#a78bfa", gradient: ["#a78bfa", "#7c3aed"], iconPath: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
  Encoding:   { color: "#34d399", gradient: ["#34d399", "#059669"], iconPath: "M16 18l6-6-6-6M8 6l-6 6 6 6" },
  Formatting: { color: "#fb923c", gradient: ["#fb923c", "#ea580c"], iconPath: "M4 7h16M4 12h10M4 17h16" },
  Numbers:    { color: "#f472b6", gradient: ["#f472b6", "#db2777"], iconPath: "M4 9h4V5M4 15h4v4M16 5l-4 6h6l-4 6" },
  Web:        { color: "#38bdf8", gradient: ["#38bdf8", "#0284c7"], iconPath: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" },
  Diff:       { color: "#f87171", gradient: ["#f87171", "#dc2626"], iconPath: "M12 3v18M3 12h18" },
  Image:      { color: "#c084fc", gradient: ["#c084fc", "#9333ea"], iconPath: "M3 3h18a2 2 0 0 1 0 4H3a2 2 0 0 1 0-4zM9 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21" },
  Diagram:    { color: "#2dd4bf", gradient: ["#2dd4bf", "#0d9488"], iconPath: "M3 3h7v7H3zM14 3h7v7h-7zM8.5 17.5h7M3 14h7v7H3zM14 14h7v7h-7zM6.5 10v4M17.5 10v4" },
  Text:       { color: "#fbbf24", gradient: ["#fbbf24", "#d97706"], iconPath: "M3 7h18M3 12h12M3 17h18" },
  System:     { color: "#ef4444", gradient: ["#ef4444", "#dc2626"], iconPath: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
};

/* ── Transforms ── */

export interface Transform {
  id: string;
  name: string;
  description: string;
  category: TransformCategory;
  inputs?: number;
  fn: (...inputs: string[]) => string | Promise<string>;
  inputViews: string[];
  outputViews: string[];
}
