import { useEffect, useState } from 'react';
import { useTabStore } from '@/stores/tabStore';
import { useDocumentStore } from '@/stores/documentStore';
import { DualPane } from '@/components/DualPane';
import { TabBar } from '@/components/TabBar';

export function App() {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const addTab = useTabStore((s) => s.addTab);
  const closeTab = useTabStore((s) => s.closeTab);
  const setActiveTab = useTabStore((s) => s.setActiveTab);
  const saveDocument = useDocumentStore((s) => s.save);
  const loadDocuments = useDocumentStore((s) => s.loadAll);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && !e.shiftKey && e.key === 't') {
        e.preventDefault();
        addTab();
      }

      if (mod && e.key === 'w') {
        e.preventDefault();
        closeTab(activeTabId);
      }

      if (mod && !e.shiftKey && e.key === 's') {
        e.preventDefault();
        const tab = useTabStore
          .getState()
          .tabs.find((t) => t.id === activeTabId);
        if (tab) saveDocument(tab);
      }

      if (mod && !e.shiftKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (idx < tabs.length) setActiveTab(tabs[idx].id);
      }

      if (mod && e.shiftKey && e.key === '[') {
        e.preventDefault();
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        if (idx > 0) setActiveTab(tabs[idx - 1].id);
      }

      if (mod && e.shiftKey && e.key === ']') {
        e.preventDefault();
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        if (idx < tabs.length - 1) setActiveTab(tabs[idx + 1].id);
      }

      // Global ⌘K / ⌘⇧P — open transform picker
      if ((mod && !e.shiftKey && e.key === 'k') || (mod && e.shiftKey && e.key === 'p')) {
        e.preventDefault();
        window.dispatchEvent(new Event('typa:open-transform-picker'));
      }

      // Global ⌘P — open saved files picker
      if (mod && !e.shiftKey && e.key === 'p') {
        e.preventDefault();
        window.dispatchEvent(new Event('typa:open-file-picker'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, tabs, addTab, closeTab, setActiveTab, saveDocument]);

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
    <div className="h-screen w-screen flex flex-col bg-bg text-text">
      <TabBar
        editingTabId={editingTabId}
        onEditingTabIdChange={setEditingTabId}
      />

      <div className="flex-1 min-h-0">
        <DualPane key={activeTabId} />
      </div>
    </div>
  );
}
