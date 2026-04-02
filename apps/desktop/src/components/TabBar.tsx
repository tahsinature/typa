import { useRef, useState } from 'react';
import { useTabStore } from '@/stores/tabStore';
import { useDocumentStore } from '@/stores/documentStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { LayoutHorizontalIcon, LayoutVerticalIcon } from '@/components/Icons';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { getTransform, CATEGORY_META } from '@typa/engine';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu';

export function TabBar() {
  const layout = useSettingsStore((s) => s.layout);
  const toggleLayout = useSettingsStore((s) => s.toggleLayout);
  const theme = useSettingsStore((s) => s.resolvedTheme);
  const toggleTheme = useSettingsStore((s) => s.toggleTheme);

  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const setActiveTab = useTabStore((s) => s.setActiveTab);
  const addTab = useTabStore((s) => s.addTab);
  const closeTab = useTabStore((s) => s.closeTab);
  const renameTab = useTabStore((s) => s.renameTab);
  const reorderTabs = useTabStore((s) => s.reorderTabs);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const dragIndexRef = useRef<number | null>(null);

  function startRename(id: string, label: string) {
    setEditingId(id);
    setEditValue(label);
  }

  function commitRename(id: string) {
    const trimmed = editValue.trim();
    if (trimmed) renameTab(id, trimmed);
    setEditingId(null);
  }

  function getTabLabel(tab: (typeof tabs)[0]) {
    if (tab.selectedTransformId && tab.selectedTransformId !== 'calculator') {
      const t = getTransform(tab.selectedTransformId);
      if (t) return t.name;
    }
    return tab.label;
  }

  function getTabMeta(tab: (typeof tabs)[0]) {
    const transformId = tab.selectedTransformId ?? 'calculator';
    const transform = transformId !== 'calculator' ? getTransform(transformId) : null;
    const category = transform?.category ?? 'Math';
    return CATEGORY_META[category];
  }

  return (
    <div className="flex items-center h-[38px] bg-bg-titlebar shrink-0 border-b border-border-subtle">
      {/* Traffic lights spacer */}
      <div className="w-[78px] h-full shrink-0 drag-region" data-tauri-drag-region />

      {/* Tab strip */}
      <div className="flex-1 h-full flex items-end gap-0 min-w-0 overflow-x-auto scrollbar-none drag-region" data-tauri-drag-region>
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          const meta = getTabMeta(tab);

          return (
            <button
              key={tab.id}
              draggable
              onDragStart={() => { dragIndexRef.current = index; }}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={() => {
                if (dragIndexRef.current !== null && dragIndexRef.current !== index) {
                  reorderTabs(dragIndexRef.current, index);
                }
                dragIndexRef.current = null;
              }}
              onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); closeTab(tab.id); } }}
              onClick={() => setActiveTab(tab.id)}
              onDoubleClick={() => startRename(tab.id, getTabLabel(tab))}
              className={`
                no-drag group relative flex items-center gap-1.5 h-[30px] px-3 rounded-t-md
                text-[11.5px] font-medium tracking-wide shrink-0 max-w-[180px]
                transition-colors duration-100 cursor-pointer select-none
                ${isActive
                  ? 'bg-bg text-text-secondary border-x border-t border-border-subtle'
                  : 'text-text-faint hover:text-text-muted hover:bg-white/[0.03]'
                }
              `}
            >
              <span
                className="size-[6px] rounded-full shrink-0"
                style={{ background: meta.color, boxShadow: `0 0 5px ${meta.color}30` }}
              />

              {editingId === tab.id ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => commitRename(tab.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(tab.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="bg-transparent outline-none text-[11.5px] w-full min-w-[40px] text-text-secondary"
                />
              ) : (
                <span className="truncate">{getTabLabel(tab)}</span>
              )}

              {tabs.length > 1 && (
                <span
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                  className={`
                    ml-0.5 flex items-center justify-center size-[16px] rounded
                    text-text-faint hover:text-text-muted hover:bg-white/[0.08]
                    transition-colors duration-100
                    ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                  `}
                >
                  <CloseIcon />
                </span>
              )}
            </button>
          );
        })}

        {/* New tab button */}
        <button
          onClick={addTab}
          className="no-drag flex items-center justify-center size-[28px] rounded-md text-text-faint hover:text-text-muted hover:bg-white/[0.05] transition-colors duration-100 cursor-pointer shrink-0 ml-0.5 mb-[2px]"
        >
          <PlusIcon />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2.5 shrink-0 no-drag">
        <Tb onClick={() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })); }} tip="Switch transform ⌘K">
          <TransformIcon />
        </Tb>

        <div className="w-px h-3 bg-border-subtle mx-0.5" />

        <Tb onClick={toggleLayout} tip={layout === 'vertical' ? 'Side-by-side ⌘L' : 'Stacked ⌘L'}>
          {layout === 'vertical' ? <LayoutHorizontalIcon /> : <LayoutVerticalIcon />}
        </Tb>
        <Tb onClick={toggleTheme} tip={theme === 'dark' ? 'Light theme' : 'Dark theme'}>
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </Tb>

        <div className="w-px h-3 bg-border-subtle mx-0.5" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center justify-center w-[28px] h-[28px] rounded-lg text-text-faint hover:text-text-muted hover:bg-white/[0.05] transition-colors duration-150 cursor-pointer">
              <MoreIcon />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { const t = useTabStore.getState().tabs.find((t) => t.id === useTabStore.getState().activeTabId); if (t) useDocumentStore.getState().save(t); }}>Save<DropdownMenuShortcut>⌘S</DropdownMenuShortcut></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function Tb({ onClick, tip, children }: { onClick: () => void; tip: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className="flex items-center justify-center w-[28px] h-[28px] rounded-lg text-text-faint hover:text-text-muted hover:bg-white/[0.05] transition-colors duration-150 cursor-pointer"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

function TransformIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M6 1v10M1 6h10" />
    </svg>
  );
}

function SunIcon() { return <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a.5.5 0 01.5.5v1a.5.5 0 01-1 0v-1A.5.5 0 018 1zm0 10a3 3 0 100-6 3 3 0 000 6zm0-1a2 2 0 110-4 2 2 0 010 4zm5.657-8.657a.5.5 0 010 .707l-.707.707a.5.5 0 11-.707-.707l.707-.707a.5.5 0 01.707 0zM3.757 11.243a.5.5 0 010 .707l-.707.707a.5.5 0 11-.707-.707l.707-.707a.5.5 0 01.707 0zM15 8a.5.5 0 01-.5.5h-1a.5.5 0 010-1h1A.5.5 0 0115 8zM3.5 8a.5.5 0 01-.5.5h-1a.5.5 0 010-1h1a.5.5 0 01.5.5zm9.193 4.243a.5.5 0 01-.707 0l-.707-.707a.5.5 0 01.707-.707l.707.707a.5.5 0 010 .707zM3.757 4.757a.5.5 0 01-.707 0l-.707-.707a.5.5 0 11.707-.707l.707.707a.5.5 0 010 .707zM8 13a.5.5 0 01.5.5v1a.5.5 0 01-1 0v-1A.5.5 0 018 13z" /></svg>; }
function MoonIcon() { return <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M6 .278a.768.768 0 01.08.858 7.21 7.21 0 00-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 01.81.316.733.733 0 01-.031.893A8.349 8.349 0 018.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 016 .278z" /></svg>; }
function MoreIcon() { return <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M3 9.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" /></svg>; }
