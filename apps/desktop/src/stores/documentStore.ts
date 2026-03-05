import { create } from 'zustand';
import { load, type Store } from '@tauri-apps/plugin-store';
import type { Tab } from './tabStore';

export interface SavedDocument {
  id: string;
  name: string;
  input: string;
  output: string;
  selectedTransformId: string | null;
  updatedAt: number;
  createdAt: number;
}

interface DocumentStore {
  documents: SavedDocument[];
  loaded: boolean;
  save: (tab: Tab) => Promise<void>;
  remove: (id: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  loadAll: () => Promise<void>;
}

let store: Store | null = null;

async function getStore(): Promise<Store> {
  if (!store) {
    store = await load('documents.json', { autoSave: true } as any);
  }
  return store;
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  documents: [],
  loaded: false,

  loadAll: async () => {
    try {
      const s = await getStore();
      const docs = ((await s.get('documents')) as SavedDocument[] | null) ?? [];
      docs.sort((a, b) => b.updatedAt - a.updatedAt);
      set({ documents: docs, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  save: async (tab) => {
    const { documents } = get();
    const now = Date.now();
    const existing = documents.find((d) => d.id === tab.id);

    const doc: SavedDocument = {
      id: tab.id,
      name: existing?.name ?? tab.label,
      input: tab.input,
      output: tab.output,
      selectedTransformId: tab.selectedTransformId,
      updatedAt: now,
      createdAt: existing?.createdAt ?? now,
    };

    const updated = existing
      ? documents.map((d) => (d.id === tab.id ? doc : d))
      : [doc, ...documents];

    updated.sort((a, b) => b.updatedAt - a.updatedAt);
    set({ documents: updated });

    try {
      const s = await getStore();
      await s.set('documents', updated);
    } catch {}
  },

  remove: async (id) => {
    const updated = get().documents.filter((d) => d.id !== id);
    set({ documents: updated });

    try {
      const s = await getStore();
      await s.set('documents', updated);
    } catch {}
  },

  rename: async (id, name) => {
    const updated = get().documents.map((d) =>
      d.id === id ? { ...d, name } : d,
    );
    set({ documents: updated });

    try {
      const s = await getStore();
      await s.set('documents', updated);
    } catch {}
  },
}));
