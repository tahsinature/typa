import { useState, useRef, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
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
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTabStore, type Tab } from '@/stores/tabStore';
import { useDocumentStore } from '@/stores/documentStore';
import { CloseIcon, DragHandleIcon, PlusIcon, LayoutHorizontalIcon, LayoutVerticalIcon } from '@/components/Icons';
import { useSettingsStore } from '@/stores/settingsStore';

interface SortableTabProps {
  tab: Tab;
  isActive: boolean;
  canClose: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onClose: () => void;
  onStartEdit: () => void;
  onRename: (name: string) => void;
  onCancelEdit: () => void;
}

function SortableTab({
  tab,
  isActive,
  canClose,
  isEditing,
  onSelect,
  onClose,
  onStartEdit,
  onRename,
  onCancelEdit,
}: SortableTabProps) {
  const [editValue, setEditValue] = useState(tab.label);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.4 : undefined,
  };

  useEffect(() => {
    if (isEditing) {
      setEditValue(tab.label);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [isEditing, tab.label]);

  const handleSubmit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== tab.label) {
      onRename(trimmed);
    }
    onCancelEdit();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      onDoubleClick={(e) => {
        e.preventDefault();
        onStartEdit();
      }}
      onAuxClick={(e) => {
        if (e.button === 1) onClose();
      }}
      data-active={isActive}
      className={`no-drag group relative flex items-center gap-1 h-full px-3 text-[12px] whitespace-nowrap cursor-default select-none transition-colors ${
        isActive
          ? 'text-text'
          : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
      }`}
    >
      {/* Active indicator — bottom border like native tabs */}
      {isActive && (
        <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-accent rounded-full" />
      )}

      {isEditing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
            if (e.key === 'Escape') onCancelEdit();
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
          className="bg-bg-input border border-accent/50 rounded px-1.5 py-0.5 text-[12px] text-text focus:outline-none w-24"
        />
      ) : (
        <span className="truncate max-w-[140px]">{tab.label}</span>
      )}

      {canClose && !isEditing && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className={`flex items-center justify-center w-[18px] h-[18px] rounded-sm transition-all ${
            isActive
              ? 'opacity-50 hover:opacity-100 hover:bg-bg-active'
              : 'opacity-0 group-hover:opacity-50 hover:!opacity-100 hover:bg-bg-active'
          }`}
        >
          <CloseIcon />
        </div>
      )}
    </div>
  );
}

interface TabBarProps {
  editingTabId: string | null;
  onEditingTabIdChange: (id: string | null) => void;
}

export function TabBar({ editingTabId, onEditingTabIdChange }: TabBarProps) {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const addTab = useTabStore((s) => s.addTab);
  const closeTab = useTabStore((s) => s.closeTab);
  const setActiveTab = useTabStore((s) => s.setActiveTab);
  const renameTab = useTabStore((s) => s.renameTab);
  const reorderTabs = useTabStore((s) => s.reorderTabs);
  const renameDocument = useDocumentStore((s) => s.rename);

  const scrollRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const fromIndex = tabs.findIndex((t) => t.id === active.id);
    const toIndex = tabs.findIndex((t) => t.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      reorderTabs(fromIndex, toIndex);
    }
  };

  const handleRenameTab = (tabId: string, name: string) => {
    renameTab(tabId, name);
    const docs = useDocumentStore.getState().documents;
    if (docs.some((d) => d.id === tabId)) {
      renameDocument(tabId, name);
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const activeEl = el.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [activeTabId]);

  return (
    <div className="flex items-center h-[38px] bg-bg shrink-0 border-b border-border-subtle">
      {/* Traffic light spacer — draggable */}
      <div
        className="w-[78px] h-full shrink-0"
        onMouseDown={() => getCurrentWindow().startDragging()}
      />

      {/* Tabs */}
      <div ref={scrollRef} className="flex items-center h-full overflow-x-auto scrollbar-none shrink-0">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={tabs.map((t) => t.id)}
            strategy={horizontalListSortingStrategy}
          >
            {tabs.map((tab) => (
              <SortableTab
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                canClose={tabs.length > 1}
                isEditing={editingTabId === tab.id}
                onSelect={() => setActiveTab(tab.id)}
                onClose={() => closeTab(tab.id)}
                onStartEdit={() => onEditingTabIdChange(tab.id)}
                onRename={(name) => handleRenameTab(tab.id, name)}
                onCancelEdit={() => onEditingTabIdChange(null)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* Remaining space */}
      <div className="flex-1 h-full" />

      {/* Layout toggle */}
      <LayoutToggle />

      {/* Drag handle */}
      <button
        onMouseDown={(e) => { e.preventDefault(); getCurrentWindow().startDragging(); }}
        className="flex items-center justify-center w-[38px] h-[38px] text-text-faint hover:text-text-muted transition-colors shrink-0 cursor-grab active:cursor-grabbing"
        title="Drag to move window"
      >
        <DragHandleIcon />
      </button>

      {/* New tab button */}
      <button
        onClick={() => addTab()}
        className="flex items-center justify-center w-[38px] h-[38px] text-text-muted hover:text-text-secondary transition-colors shrink-0"
        title="New tab (⌘T)"
      >
        <PlusIcon />
      </button>
    </div>
  );
}

function LayoutToggle() {
  const layout = useSettingsStore((s) => s.layout);
  const toggleLayout = useSettingsStore((s) => s.toggleLayout);
  const isVertical = layout === 'vertical';

  return (
    <button
      onClick={toggleLayout}
      className="flex items-center justify-center w-[38px] h-[38px] text-text-faint hover:text-text-muted transition-colors shrink-0"
      title={isVertical ? 'Switch to side-by-side' : 'Switch to top-bottom'}
    >
      {isVertical ? <LayoutHorizontalIcon /> : <LayoutVerticalIcon />}
    </button>
  );
}
