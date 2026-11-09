import { create } from 'zustand';

export interface ImageInfo {
  width: number;
  height: number;
  /** Size of the exported PNG in bytes. */
  bytes: number;
}

/** `info` stays at the last result while a new measurement is running. */
export interface ImageInfoEntry {
  info: ImageInfo | null;
  measuring: boolean;
}

interface ImageInfoStore {
  byTab: Record<string, ImageInfoEntry>;
  setEntry: (tabId: string, entry: ImageInfoEntry) => void;
  clearEntry: (tabId: string) => void;
}

/** Export size of the image shown in each tab, reported by image viewers for the status bar. */
export const useImageInfoStore = create<ImageInfoStore>((set) => ({
  byTab: {},
  setEntry: (tabId, entry) => set((state) => ({ byTab: { ...state.byTab, [tabId]: entry } })),
  clearEntry: (tabId) =>
    set((state) => {
      const { [tabId]: _removed, ...rest } = state.byTab;
      return { byTab: rest };
    }),
}));
