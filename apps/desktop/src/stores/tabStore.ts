import { create } from 'zustand';

export interface Tab {
  id: string;
  label: string;
  inputs: string[];
  output: string;
  selectedTransformId: string | null;
}

interface TabStore {
  tabs: Tab[];
  activeTabId: string;
  addTab: () => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateInput: (id: string, index: number, text: string) => void;
  updateOutput: (id: string, text: string) => void;
  setSelectedTransform: (id: string, transformId: string | null) => void;
  renameTab: (id: string, label: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
}

let nextId = 1;

function createTab(): Tab {
  const id = `tab-${nextId++}`;
  return {
    id,
    label: `Tab ${nextId - 1}`,
    inputs: [''],
    output: '',
    selectedTransformId: 'calculator',
  };
}

const initialTab = createTab();

export const useTabStore = create<TabStore>((set, get) => ({
  tabs: [initialTab],
  activeTabId: initialTab.id,

  addTab: () => {
    const tab = createTab();
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }));
  },

  closeTab: (id) => {
    const { tabs, activeTabId } = get();
    if (tabs.length <= 1) return;

    const idx = tabs.findIndex((t) => t.id === id);
    const newTabs = tabs.filter((t) => t.id !== id);
    const newActive =
      activeTabId === id
        ? newTabs[Math.min(idx, newTabs.length - 1)].id
        : activeTabId;

    set({ tabs: newTabs, activeTabId: newActive });
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  updateInput: (id, index, text) => {
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== id) return t;
        const inputs = [...t.inputs];
        while (inputs.length <= index) inputs.push('');
        inputs[index] = text;
        return { ...t, inputs };
      }),
    }));
  },

  updateOutput: (id, text) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, output: text } : t)),
    }));
  },

  setSelectedTransform: (id, transformId) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id ? { ...t, selectedTransformId: transformId } : t,
      ),
    }));
  },

  renameTab: (id, label) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, label } : t)),
    }));
  },

  reorderTabs: (fromIndex, toIndex) => {
    set((s) => {
      const newTabs = [...s.tabs];
      const [moved] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, moved);
      return { tabs: newTabs };
    });
  },
}));
