import type { ComponentType } from "react";
import type { ViewerRef } from "@typa/engine";

export interface ViewerConfig {
  id: string;
  name: string;
  icon: ComponentType;
  component: ComponentType<{ data: unknown; theme: "dark" | "light" }>;
}

export interface ResolvedViewer extends ViewerConfig {
  parse: (output: string) => unknown;
}

const viewers = new Map<string, ViewerConfig>();

export function registerViewer(viewer: ViewerConfig) {
  viewers.set(viewer.id, viewer);
}

export function getViewersForTransform(viewerRefs: ViewerRef[] | undefined): ResolvedViewer[] {
  if (!viewerRefs) return [];
  return viewerRefs
    .map((ref) => {
      const config = viewers.get(ref.id);
      if (!config) return null;
      return { ...config, parse: ref.parse };
    })
    .filter(Boolean) as ResolvedViewer[];
}
