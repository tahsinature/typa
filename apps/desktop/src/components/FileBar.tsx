import { useState } from 'react';
import { useDocumentStore, type SavedDocument } from '@/stores/documentStore';
import { useTabStore } from '@/stores/tabStore';
import { FileIcon, ChevronIcon, DeleteIcon } from '@/components/Icons';

export function FileBar() {
  const documents = useDocumentStore((s) => s.documents);
  const loaded = useDocumentStore((s) => s.loaded);
  const removeDoc = useDocumentStore((s) => s.remove);
  const renameDoc = useDocumentStore((s) => s.rename);
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const setActiveTab = useTabStore((s) => s.setActiveTab);
  const [collapsed, setCollapsed] = useState(false);

  const openDocument = (doc: SavedDocument) => {
    const existingTab = tabs.find((t) => t.id === doc.id);
    if (existingTab) {
      setActiveTab(existingTab.id);
      return;
    }
    const store = useTabStore.getState();
    store.tabs.push({
      id: doc.id,
      label: doc.name,
      input: doc.input,
      input2: '',
      output: doc.output,
      selectedTransformId: doc.selectedTransformId,
    });
    useTabStore.setState({ tabs: [...store.tabs], activeTabId: doc.id });
  };

  return (
    <div className="h-full w-full flex flex-col bg-bg select-none">
      {/* Section header */}
      <div
        className="flex items-center h-[28px] px-3 cursor-pointer hover:bg-bg-hover/50 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <ChevronIcon className={`shrink-0 text-text-muted transition-transform duration-150 ${collapsed ? '-rotate-90' : ''}`} />
        <span className="ml-1.5 text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
          Saved
        </span>
        {loaded && documents.length > 0 && (
          <span className="ml-auto text-[10px] text-text-faint tabular-nums">
            {documents.length}
          </span>
        )}
      </div>

      {/* File list */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto">
          {!loaded && (
            <div className="px-5 py-3 text-[12px] text-text-faint">Loading...</div>
          )}

          {loaded && documents.length === 0 && (
            <div className="px-5 py-6 text-[12px] text-text-faint text-center leading-relaxed">
              No saved files
              <div className="mt-1 opacity-60">⌘S to save</div>
            </div>
          )}

          {loaded &&
            documents.map((doc) => (
              <FileBarItem
                key={doc.id}
                doc={doc}
                isActive={activeTabId === doc.id}
                isOpen={tabs.some((t) => t.id === doc.id)}
                onOpen={() => openDocument(doc)}
                onRename={(name) => renameDoc(doc.id, name)}
                onDelete={() => removeDoc(doc.id)}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function FileBarItem({
  doc,
  isActive,
  isOpen,
  onOpen,
  onRename,
  onDelete,
}: {
  doc: SavedDocument;
  isActive: boolean;
  isOpen: boolean;
  onOpen: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(doc.name);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== doc.name) {
      onRename(trimmed);
    } else {
      setName(doc.name);
    }
    setEditing(false);
  };

  return (
    <div
      className={`group flex items-center h-[26px] pl-5 pr-2 cursor-default transition-colors text-[12px] ${
        isActive
          ? 'bg-accent/15 text-text'
          : isOpen
            ? 'text-text hover:bg-bg-hover/50'
            : 'text-text-secondary hover:bg-bg-hover/50 hover:text-text'
      }`}
      onClick={onOpen}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
    >
      <FileIcon />

      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
            if (e.key === 'Escape') {
              setName(doc.name);
              setEditing(false);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 ml-1.5 bg-bg-input border border-accent/40 rounded px-1 py-0.5 text-[12px] text-text focus:outline-none"
        />
      ) : (
        <span className="flex-1 min-w-0 truncate ml-1.5">{doc.name}</span>
      )}

      {/* Delete on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="opacity-0 group-hover:opacity-40 hover:!opacity-80 p-0.5 rounded-sm hover:bg-bg-active transition-all ml-1"
        title="Delete"
      >
        <DeleteIcon />
      </button>
    </div>
  );
}
