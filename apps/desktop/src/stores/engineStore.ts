import { create } from 'zustand';
import { TypaEngine } from '@typa/engine';
import { fetchCurrencyRates } from '@/lib/currency';

interface EngineStore {
  engine: TypaEngine;
  /** Latest exchange rates (USD base), or null until they load. */
  currencyRates: Record<string, number> | null;
  loadCurrencyRates: () => Promise<void>;
}

export const useEngineStore = create<EngineStore>((set, get) => ({
  engine: new TypaEngine(),
  currencyRates: null,

  loadCurrencyRates: async () => {
    const rates = await fetchCurrencyRates();
    if (Object.keys(rates).length > 0) {
      get().engine.setCurrencyRates(rates);
      set({ currencyRates: rates });
    }
  },
}));

// Load currency rates on startup
useEngineStore.getState().loadCurrencyRates();
