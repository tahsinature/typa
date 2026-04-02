import { create } from 'zustand';

function getSystemTheme(): 'dark' | 'light' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function applyTheme(resolved: 'dark' | 'light') {
  if (resolved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

export type PaletteStyle = 'raycast' | 'linear' | 'arc';

interface SettingsStore {
  theme: 'dark' | 'light' | 'system';
  resolvedTheme: 'dark' | 'light';
  layout: 'horizontal' | 'vertical';
  sidebarOpen: boolean;
  fontSize: number;
  paletteStyle: PaletteStyle;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  toggleTheme: () => void;
  toggleLayout: () => void;
  toggleSidebar: () => void;
  setPaletteStyle: (style: PaletteStyle) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  theme: 'system',
  resolvedTheme: getSystemTheme(),
  layout: 'horizontal',
  sidebarOpen: true,
  fontSize: 13,
  paletteStyle: 'raycast',

  setTheme: (theme) => {
    const resolved = theme === 'system' ? getSystemTheme() : theme;
    applyTheme(resolved);
    set({ theme, resolvedTheme: resolved });
  },

  toggleTheme: () => {
    const { resolvedTheme } = get();
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    set({ theme: next, resolvedTheme: next });
  },

  setPaletteStyle: (style) => set({ paletteStyle: style }),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  toggleLayout: () => {
    const { layout } = get();
    set({ layout: layout === 'horizontal' ? 'vertical' : 'horizontal' });
  },

  zoomIn: () => {
    const { fontSize } = get();
    if (fontSize < 32) set({ fontSize: fontSize + 1 });
  },

  zoomOut: () => {
    const { fontSize } = get();
    if (fontSize > 8) set({ fontSize: fontSize - 1 });
  },

  resetZoom: () => set({ fontSize: 13 }),
}));

// React to system theme changes
window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', (e) => {
    const { theme } = useSettingsStore.getState();
    if (theme === 'system') {
      const resolved = e.matches ? 'dark' : 'light';
      applyTheme(resolved);
      useSettingsStore.setState({ resolvedTheme: resolved });
    }
  });
