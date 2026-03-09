import type { ComponentType } from "react";

export interface InputViewConfig {
  id: string;
  name: string;
  icon: ComponentType;
  component: ComponentType<{
    input: string;
    onInputChange: (value: string) => void;
    theme: "dark" | "light";
  }>;
}

const inputViews = new Map<string, InputViewConfig>();

export function registerInputView(view: InputViewConfig) {
  inputViews.set(view.id, view);
}

export function getInputViewsForTransform(viewIds: string[]): InputViewConfig[] {
  return viewIds
    .map((id) => inputViews.get(id))
    .filter(Boolean) as InputViewConfig[];
}

/** @deprecated Use registerInputView */
export const registerInputWidget = registerInputView;
/** @deprecated Use InputViewConfig */
export type InputWidgetConfig = InputViewConfig;
