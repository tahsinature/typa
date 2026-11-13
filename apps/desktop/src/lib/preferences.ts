import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useSettingsStore } from '@/stores/settingsStore';

type SettingsState = ReturnType<typeof useSettingsStore.getState>;
type Preferences = Pick<SettingsState, 'theme' | 'layout' | 'sidebarOpen' | 'fontSize' | 'paletteStyle'>;

function snapshot(state: SettingsState): Preferences {
  return {
    theme: state.theme,
    layout: state.layout,
    sidebarOpen: state.sidebarOpen,
    fontSize: state.fontSize,
    paletteStyle: state.paletteStyle,
  };
}

export function openPreferences() {
  if (!isTauri()) {
    window.alert('Preferences uses a native macOS window. Open it in the Typa desktop app.');
    return;
  }
  void invoke('open_preferences').catch((error) => console.error('Could not open Preferences:', error));
}

export async function syncNativePreferences() {
  if (!isTauri()) return;
  let applyingNativeSettings = false;
  let previous = JSON.stringify(snapshot(useSettingsStore.getState()));
  const apply = (settings: Preferences) => {
    applyingNativeSettings = true;
    useSettingsStore.getState().setTheme(settings.theme);
    useSettingsStore.setState(settings);
    previous = JSON.stringify(snapshot(useSettingsStore.getState()));
    applyingNativeSettings = false;
  };

  try {
    await listen<Preferences>('preferences-changed', ({ payload }) => apply(payload));
    const saved = await invoke<Preferences>('load_preferences', {
      fallback: snapshot(useSettingsStore.getState()),
    });
    apply(saved);
    useSettingsStore.subscribe((state) => {
      if (applyingNativeSettings) return;
      const settings = snapshot(state);
      const serialized = JSON.stringify(settings);
      if (serialized === previous) return;
      previous = serialized;
      void invoke('save_preferences', { settings }).catch((error) => {
        console.error('Could not save Preferences:', error);
      });
    });
  } catch (error) {
    console.error('Could not initialize Preferences:', error);
  }
}
