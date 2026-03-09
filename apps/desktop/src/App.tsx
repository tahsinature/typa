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

        <div className="flex-1 min-h-0">
          <DualPane key={activeTabId} />
        </div>

        <StatusBar />
      </div>
      <CommandPalette />
    </TooltipProvider>
  );
}
