import { createContext, useContext } from "react";

/** Id of the tab a pane belongs to, so viewers can report tab-specific state. */
export const TabIdContext = createContext<string | null>(null);

export function useTabId(): string | null {
  return useContext(TabIdContext);
}
