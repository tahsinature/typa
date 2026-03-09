import type { ComponentType } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface OutputViewConfig<T = any> {
  id: string;
  name: string;
  icon: ComponentType;
  parse: (output: string) => T;
  component: ComponentType<{ data: T; theme: "dark" | "light" }>;
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
