import type { ComponentType } from "react";
import type { Transform } from "@typa/engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface OutputViewConfig<T = any> {
  id: string;
  name: string;
  icon: ComponentType;
  // `richData` is supplied by transforms that return { text, data } from `fn`
  // (see TransformResult). Views can prefer it over re-parsing the output text.
  parse: (output: string, richData?: unknown) => T;
  component: ComponentType<{
    data: T;
    theme: "dark" | "light";
    // Round-trip props (present only for single-input transforms): let a view
    // write back into the input — e.g. marking a node stamps a field into it.
    input?: string;
    onInputChange?: (value: string) => void;
    transform?: Transform;
  }>;
}

const outputViews = new Map<string, OutputViewConfig>();

export function registerOutputView<T>(view: OutputViewConfig<T>) {
  outputViews.set(view.id, view);
}

export function getOutputViewsForTransform(viewIds: string[]): OutputViewConfig[] {
  return viewIds.map((id) => outputViews.get(id)).filter(Boolean) as OutputViewConfig[];
}

/** @deprecated Use registerOutputView */
export const registerViewer = registerOutputView;
