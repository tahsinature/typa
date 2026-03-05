import type { ComponentType } from "react";

export interface InputWidgetConfig {
  id: string;
  name: string;
  icon: ComponentType;
  component: ComponentType<{
    input: string;
    onInputChange: (value: string) => void;
    theme: "dark" | "light";
  }>;
}

const widgets = new Map<string, InputWidgetConfig>();

export function registerInputWidget(widget: InputWidgetConfig) {
  widgets.set(widget.id, widget);
}

export function getInputWidgetsForTransform(widgetIds: string[] | undefined): InputWidgetConfig[] {
  if (!widgetIds) return [];
  return widgetIds.map((id) => widgets.get(id)).filter(Boolean) as InputWidgetConfig[];
}
