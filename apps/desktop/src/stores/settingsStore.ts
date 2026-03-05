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

interface SettingsStore {
  theme: 'dark' | 'light' | 'system';
  resolvedTheme: 'dark' | 'light';
  layout: 'horizontal' | 'vertical';
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  toggleTheme: () => void;
  toggleLayout: () => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  theme: 'system',
  resolvedTheme: getSystemTheme(),
  layout: 'horizontal',

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

  toggleLayout: () => {
    const { layout } = get();
    set({ layout: layout === 'horizontal' ? 'vertical' : 'horizontal' });
  },
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
