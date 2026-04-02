import { useEffect } from 'react';
import { useTabStore } from '@/stores/tabStore';
import { useDocumentStore } from '@/stores/documentStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { DualPane } from '@/components/DualPane';
import { TabBar } from '@/components/TabBar';
import { StatusBar } from '@/components/StatusBar';
import { CommandPalette } from '@/components/CommandPalette';
import { TooltipProvider } from '@/components/ui/tooltip';

export function App() {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const saveDocument = useDocumentStore((s) => s.save);
  const loadDocuments = useDocumentStore((s) => s.loadAll);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && !e.shiftKey && e.key === 's') {
        e.preventDefault();
        const tab = useTabStore
          .getState()
          .tabs.find((t) => t.id === activeTabId);
        if (tab) saveDocument(tab);
      }

      // Tabs: ⌘T new, ⌘W close, ⌘1-9 switch
      if (mod && !e.shiftKey && e.key === 't') {
        e.preventDefault();
        useTabStore.getState().addTab();
      }
      if (mod && !e.shiftKey && e.key === 'w') {
        e.preventDefault();
        useTabStore.getState().closeTab(useTabStore.getState().activeTabId);
      }
      if (mod && !e.shiftKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const tabs = useTabStore.getState().tabs;
        const idx = parseInt(e.key) - 1;
        if (idx < tabs.length) useTabStore.getState().setActiveTab(tabs[idx].id);
      }

      // Layout: ⌘L toggle
      if (mod && !e.shiftKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        useSettingsStore.getState().toggleLayout();
      }

      // Fullscreen: ⌘⇧⏎ toggle
      if (mod && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('toggle-fullscreen'));
      }

      // Zoom: ⌘+= / ⌘+- / ⌘+0
      if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        useSettingsStore.getState().zoomIn();
      }
      if (mod && e.key === '-') {
        e.preventDefault();
        useSettingsStore.getState().zoomOut();
      }
      if (mod && e.key === '0') {
        e.preventDefault();
        useSettingsStore.getState().resetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, saveDocument]);

  useEffect(() => {
    const prevent = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
    };
  }, []);


  return (
    <TooltipProvider delayDuration={400} skipDelayDuration={100}>
      <div className="h-screen w-screen flex flex-col bg-bg text-text">
        <TabBar />

        <div className="flex-1 min-h-0 relative">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className="h-full w-full"
              style={{ display: tab.id === activeTabId ? 'contents' : 'none' }}
            >
              <DualPane tabId={tab.id} />
            </div>
          ))}
        </div>

        <StatusBar />
      </div>
      <CommandPalette />
    </TooltipProvider>
  );
}
