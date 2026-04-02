import { useState } from 'react';
import { useDocumentStore, type SavedDocument } from '@/stores/documentStore';
import { useTabStore } from '@/stores/tabStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { getTransform, CATEGORY_META } from '@typa/engine';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Modifier } from '@dnd-kit/core';

const restrictToVerticalAxis: Modifier = ({ transform }) => ({
  ...transform,
  x: 0,
});

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getDocMeta(doc: SavedDocument) {
  const transformId = doc.selectedTransformId ?? 'calculator';
  const transform = transformId !== 'calculator' ? getTransform(transformId) : null;
  const category = transform?.category ?? 'Math';
  const meta = CATEGORY_META[category];
  const transformName = transform?.name ?? 'Calculator';
  return { meta, transformName, category };
}

export function FileBar() {
  const documents = useDocumentStore((s) => s.documents);
  const loaded = useDocumentStore((s) => s.loaded);
  const removeDoc = useDocumentStore((s) => s.remove);
  const removeAllDocs = useDocumentStore((s) => s.removeAll);
  const renameDoc = useDocumentStore((s) => s.rename);
  const reorderDocs = useDocumentStore((s) => s.reorder);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const setActiveTab = useTabStore((s) => s.setActiveTab);
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

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
      customLabel: true,
      inputs: doc.inputs,
      output: doc.output,
      selectedTransformId: doc.selectedTransformId,
      lastExecMs: null,
    });
    useTabStore.setState({ tabs: [...store.tabs], activeTabId: doc.id });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = documents.findIndex((d) => d.id === active.id);
    const toIndex = documents.findIndex((d) => d.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      reorderDocs(fromIndex, toIndex);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-bg-surface/40 select-none">
      {/* Header */}
      <div className="flex items-center justify-between h-[32px] px-3 shrink-0 border-b border-border-subtle/50">
        <span className="text-[10px] font-semibold text-text-muted tracking-[0.08em] uppercase">
          Files
        </span>
        <div className="flex items-center gap-1">
          {loaded && documents.length > 0 && (
            <>
              <span className="text-[10px] text-text-faint tabular-nums px-1.5 py-0.5 rounded-md bg-white/[0.04]">
                {documents.length}
              </span>
              <button
                onClick={() => {
                  if (confirmDeleteAll) {
                    removeAllDocs();
                    setConfirmDeleteAll(false);
                  } else {
                    setConfirmDeleteAll(true);
                    setTimeout(() => setConfirmDeleteAll(false), 2000);
                  }
                }}
                onMouseLeave={() => setConfirmDeleteAll(false)}
                className={`flex items-center justify-center size-[20px] rounded-md transition-all cursor-pointer ${
                  confirmDeleteAll
                    ? 'bg-danger/15 text-danger'
                    : 'text-text-faint hover:text-text-muted hover:bg-white/[0.06]'
                }`}
                title={confirmDeleteAll ? 'Click again to delete all' : 'Delete all files'}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                </svg>
              </button>
            </>
          )}
          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center size-[20px] rounded-md text-text-faint hover:text-text-muted hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Close sidebar ⌘B"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M0 3a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H2a2 2 0 01-2-2V3zm5-1v12h9a1 1 0 001-1V3a1 1 0 00-1-1H5zM4 2H2a1 1 0 00-1 1v10a1 1 0 001 1h2V2z" />
              <path d="M8.5 6l-2 2 2 2" fill="none" stroke="var(--bg-titlebar)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto py-1">
        {!loaded && (
          <div className="px-3 py-8 text-center">
            <div className="text-[11px] text-text-faint animate-pulse">Loading...</div>
          </div>
        )}

        {loaded && documents.length === 0 && (
          <div className="px-4 py-10 text-center">
            <div className="flex items-center justify-center mx-auto mb-3 w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-text-faint/50">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <p className="text-[11px] text-text-muted">No saved files</p>
            <p className="text-[10px] text-text-muted/60 mt-1">Press ⌘S to save</p>
          </div>
        )}

        {loaded && documents.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <SortableContext items={documents.map((d) => d.id)} strategy={verticalListSortingStrategy}>
              {documents.map((doc) => (
                <SortableFileBarItem
                  key={doc.id}
                  doc={doc}
                  isActive={activeTabId === doc.id}
                  isOpen={tabs.some((t) => t.id === doc.id)}
                  onOpen={() => openDocument(doc)}
                  onRename={(name) => renameDoc(doc.id, name)}
                  onDelete={() => removeDoc(doc.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

function SortableFileBarItem(props: {
  doc: SavedDocument;
  isActive: boolean;
  isOpen: boolean;
  onOpen: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.doc.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.85 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <FileBarItem {...props} isDragging={isDragging} dragListeners={listeners} />
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
  isDragging,
  dragListeners,
}: {
  doc: SavedDocument;
  isActive: boolean;
  isOpen: boolean;
  onOpen: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  isDragging?: boolean;
  dragListeners?: Record<string, Function>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(doc.name);
  const { transformName } = getDocMeta(doc);
  const openTab = useTabStore((s) => s.tabs.find((t) => t.id === doc.id));
  const isModified = openTab && (
    openTab.inputs.join('\0') !== doc.inputs.join('\0') ||
    openTab.output !== doc.output ||
    openTab.selectedTransformId !== doc.selectedTransformId
  );

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
      className={`group flex items-start gap-2 mx-1.5 mb-0.5 px-2.5 py-2 rounded-lg cursor-default transition-all duration-150 ${
        isDragging
          ? 'bg-bg-elevated shadow-lg ring-1 ring-accent/20 scale-[1.02]'
          : isActive
            ? 'bg-accent/10'
            : 'hover:bg-white/[0.04]'
      }`}
      onClick={onOpen}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
    >
      {/* Drag handle */}
      <span
        className="shrink-0 mt-[4px] text-text-muted hover:text-text-secondary cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        {...dragListeners}
      >
        <svg width="8" height="10" viewBox="0 0 8 10" fill="currentColor">
          <circle cx="2" cy="1.5" r="1" />
          <circle cx="6" cy="1.5" r="1" />
          <circle cx="2" cy="5" r="1" />
          <circle cx="6" cy="5" r="1" />
          <circle cx="2" cy="8.5" r="1" />
          <circle cx="6" cy="8.5" r="1" />
        </svg>
      </span>

      {/* Modified indicator */}
      {isModified && (
        <span className="size-[6px] rounded-full shrink-0 mt-[5px] bg-text-muted" />
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSubmit}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') handleSubmit();
              if (e.key === 'Escape') {
                setName(doc.name);
                setEditing(false);
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-bg-input border border-accent/30 rounded-md px-1.5 py-0.5 text-[11px] text-text focus:outline-none -ml-1.5 -mt-0.5"
          />
        ) : (
          <>
            <div className={`text-[12px] font-medium truncate leading-tight ${
              isActive ? 'text-text' : 'text-text-secondary'
            }`}>
              {doc.name}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-text-muted truncate">{transformName}</span>
              <span className="text-[10px] text-text-faint">·</span>
              <span className="text-[10px] text-text-muted/80 shrink-0">{timeAgo(doc.updatedAt)}</span>
            </div>
          </>
        )}
      </div>

      {/* Delete — click once to arm, click again to confirm */}
      {!editing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirmDelete) {
              onDelete();
              setConfirmDelete(false);
            } else {
              setConfirmDelete(true);
              setTimeout(() => setConfirmDelete(false), 2000);
            }
          }}
          onMouseLeave={() => setConfirmDelete(false)}
          className={`flex items-center justify-center size-[22px] rounded-md transition-all shrink-0 cursor-pointer ${
            confirmDelete
              ? 'opacity-100 bg-danger/15 text-danger'
              : 'opacity-0 group-hover:opacity-40 hover:!opacity-90 hover:bg-white/[0.08]'
          }`}
          title={confirmDelete ? 'Click again to delete' : 'Delete'}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
          </svg>
        </button>
      )}
    </div>
  );
}
