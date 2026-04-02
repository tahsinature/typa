import { create } from 'zustand';
import { load, type Store } from '@tauri-apps/plugin-store';
import type { Tab } from './tabStore';
import { useTabStore } from './tabStore';

export interface SavedDocument {
  id: string;
  name: string;
  inputs: string[];
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
  removeAll: () => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  reorder: (fromIndex: number, toIndex: number) => Promise<void>;
  loadAll: () => Promise<void>;
}

let store: Store | null = null;

async function getStore(): Promise<Store> {
  if (!store) {
    store = await load('documents.json', { autoSave: true } as any);
  }
  return store;
}

// Migrate old documents that had input/input2 fields
function migrateDoc(raw: any): SavedDocument {
  if (raw.inputs) return raw;
  const inputs: string[] = [raw.input ?? ''];
  if (raw.input2) inputs.push(raw.input2);
  return { ...raw, inputs, input: undefined, input2: undefined };
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  documents: [],
  loaded: false,

  loadAll: async () => {
    try {
      const s = await getStore();
      const raw = ((await s.get('documents')) as any[] | null) ?? [];
      const docs = raw.map(migrateDoc);
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
      name: tab.customLabel ? tab.label : (existing?.name ?? tab.label),
      inputs: tab.inputs,
      output: tab.output,
      selectedTransformId: tab.selectedTransformId,
      updatedAt: now,
      createdAt: existing?.createdAt ?? now,
    };

    const updated = existing
      ? documents.map((d) => (d.id === tab.id ? doc : d))
      : [doc, ...documents];

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

  removeAll: async () => {
    set({ documents: [] });
    try {
      const s = await getStore();
      await s.set('documents', []);
    } catch {}
  },

  reorder: async (fromIndex, toIndex) => {
    const docs = [...get().documents];
    const [moved] = docs.splice(fromIndex, 1);
    docs.splice(toIndex, 0, moved);
    set({ documents: docs });

    try {
      const s = await getStore();
      await s.set('documents', docs);
    } catch {}
  },

  rename: async (id, name) => {
    const updated = get().documents.map((d) =>
      d.id === id ? { ...d, name } : d,
    );
    set({ documents: updated });

    // Sync to tab if open
    useTabStore.getState().renameTab(id, name);

    try {
      const s = await getStore();
      await s.set('documents', updated);
    } catch {}
  },
}));
