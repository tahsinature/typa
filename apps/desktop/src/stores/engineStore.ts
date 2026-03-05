import { create } from 'zustand';
import { TypaEngine } from '@typa/engine';
import type { LineResult } from '@typa/engine';

interface EngineStore {
  engine: TypaEngine;
  results: Record<string, LineResult[]>;
  evaluate: (tabId: string, content: string) => void;
}

const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

export const useEngineStore = create<EngineStore>((set, get) => ({
  engine: new TypaEngine(),
  results: {},

  evaluate: (tabId, content) => {
    clearTimeout(debounceTimers[tabId]);
    debounceTimers[tabId] = setTimeout(() => {
      const { engine } = get();
      const lineResults = engine.evaluateDocument(content);
      set((s) => ({ results: { ...s.results, [tabId]: lineResults } }));
    }, 100);
  },
}));
