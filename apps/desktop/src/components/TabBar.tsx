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
  const sidebarOpen = useSettingsStore((s) => s.sidebarOpen);
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);
  const theme = useSettingsStore((s) => s.resolvedTheme);
  const toggleTheme = useSettingsStore((s) => s.toggleTheme);

  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const setActiveTab = useTabStore((s) => s.setActiveTab);
  const addTab = useTabStore((s) => s.addTab);
  const closeTab = useTabStore((s) => s.closeTab);
  const renameTab = useTabStore((s) => s.renameTab);
  const reorderTabs = useTabStore((s) => s.reorderTabs);
  const documents = useDocumentStore((s) => s.documents);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; side: 'left' | 'right' } | null>(null);

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
    if (tab.customLabel) return tab.label;
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
    <div className="flex items-center h-[42px] bg-bg-titlebar shrink-0 border-b border-border-subtle/60">
      {/* Traffic lights spacer */}
      <div className="w-[78px] h-full shrink-0 drag-region" data-tauri-drag-region />

      {/* Sidebar toggle */}
      <div className="shrink-0 no-drag mr-1">
        <Tb onClick={toggleSidebar} tip={sidebarOpen ? 'Hide sidebar ⌘B' : 'Show sidebar ⌘B'}>
          <SidebarIcon />
        </Tb>
      </div>

      {/* Tab strip */}
      <div className="flex-1 h-full flex items-center gap-1 px-0.5 min-w-0 overflow-x-auto scrollbar-none drag-region" data-tauri-drag-region>
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          const meta = getTabMeta(tab);
          const savedDoc = documents.find((d) => d.id === tab.id);
          const isModified = savedDoc && (
            savedDoc.inputs.join('\0') !== tab.inputs.join('\0') ||
            savedDoc.output !== tab.output ||
            savedDoc.selectedTransformId !== tab.selectedTransformId
          );
          const showDot = !!isModified;
          const isEditing = editingId === tab.id;
          const isBeingDragged = dragId === tab.id;

          return (
            <div
              key={tab.id}
              draggable={!isEditing}
              onDragStart={(e) => {
                setDragId(tab.id);
                e.dataTransfer.effectAllowed = 'move';
                // Use a transparent image so the browser ghost doesn't show
                const img = new Image();
                img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                e.dataTransfer.setDragImage(img, 0, 0);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const rect = e.currentTarget.getBoundingClientRect();
                const side = e.clientX < rect.left + rect.width / 2 ? 'left' : 'right';
                setDropTarget({ id: tab.id, side });
              }}
              onDragLeave={() => {
                if (dropTarget?.id === tab.id) setDropTarget(null);
              }}
              onDrop={() => {
                if (dragId && dragId !== tab.id && dropTarget) {
                  const fromIndex = tabs.findIndex((t) => t.id === dragId);
                  let toIndex = tabs.findIndex((t) => t.id === tab.id);
                  if (fromIndex !== -1 && toIndex !== -1) {
                    // If dropping on right side and dragging from before, adjust index
                    if (dropTarget.side === 'right' && fromIndex < toIndex) {
                      // toIndex stays same (splice behavior handles it)
                    } else if (dropTarget.side === 'right' && fromIndex > toIndex) {
                      toIndex += 1;
                    }
                    reorderTabs(fromIndex, toIndex);
                  }
                }
                setDragId(null);
                setDropTarget(null);
              }}
              onDragEnd={() => {
                setDragId(null);
                setDropTarget(null);
              }}
              onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); closeTab(tab.id); } }}
              onClick={() => { if (!isEditing) setActiveTab(tab.id); }}
              onDoubleClick={() => startRename(tab.id, getTabLabel(tab))}
              role="tab"
              className={`
                no-drag group relative flex items-center gap-2 h-[28px] px-3 rounded-lg
                text-[11px] font-medium tracking-wide shrink-0 max-w-[200px]
                cursor-pointer transition-opacity duration-100
                ${isEditing ? '' : 'select-none'}
                ${!savedDoc
                  ? isActive
                    ? 'text-text-secondary italic'
                    : 'text-text-faint italic hover:text-text-muted'
                  : isActive
                    ? 'text-text'
                    : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.04]'
                }
              `}
              style={{
                opacity: isBeingDragged ? 0.4 : undefined,
                ...(!savedDoc
                  ? isActive
                    ? { background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.12)' }
                    : { border: '1px dashed rgba(255,255,255,0.06)' }
                  : isActive
                    ? {
                        background: `linear-gradient(135deg, ${meta.color}12, ${meta.color}06)`,
                        boxShadow: `0 0 0 1px ${meta.color}18, inset 0 1px 0 ${meta.color}10, 0 1px 3px rgba(0,0,0,0.15)`,
                      }
                    : undefined
                ),
              }}
            >
              {/* Drop indicator */}
              {dropTarget?.id === tab.id && dragId !== tab.id && (
                <span
                  className="absolute top-1 bottom-1 w-[2px] rounded-full bg-accent"
                  style={{ [dropTarget.side === 'left' ? 'left' : 'right']: -2 }}
                />
              )}

              {showDot && (
                <span className="size-[5px] rounded-full shrink-0 bg-text-muted" />
              )}

              {isEditing ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={() => commitRename(tab.id)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') commitRename(tab.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="bg-transparent outline-none text-[11px] w-full min-w-[40px] text-text-secondary"
                />
              ) : (
                <span className="truncate">{getTabLabel(tab)}</span>
              )}

              {tabs.length > 1 && (
                <span
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={`
                    ml-auto flex items-center justify-center size-[16px] rounded-md
                    text-text-faint hover:text-text-muted hover:bg-white/[0.08]
                    transition-all duration-100
                    ${isActive ? 'opacity-60 hover:opacity-100' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100'}
                  `}
                >
                  <CloseIcon />
                </span>
              )}
            </div>
          );
        })}

        {/* New tab button */}
        <button
          onClick={addTab}
          className="no-drag flex items-center justify-center size-[26px] rounded-lg text-text-muted hover:text-text-secondary hover:bg-white/[0.05] transition-all duration-150 cursor-pointer shrink-0 ml-0.5"
        >
          <PlusIcon />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2.5 shrink-0 no-drag">
        <Tb onClick={() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })); }} tip="Switch transform ⌘K">
          <TransformIcon />
        </Tb>

        <ToolbarSep />

        <Tb onClick={toggleLayout} tip={layout === 'vertical' ? 'Side-by-side ⌘L' : 'Stacked ⌘L'}>
          {layout === 'vertical' ? <LayoutHorizontalIcon /> : <LayoutVerticalIcon />}
        </Tb>
        <Tb onClick={toggleTheme} tip={theme === 'dark' ? 'Light theme' : 'Dark theme'}>
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </Tb>

        <ToolbarSep />

        <Tb onClick={() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', metaKey: true, bubbles: true })); }} tip="Shortcuts ⌘/">
          <KeyboardIcon />
        </Tb>

        <ToolbarSep />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center justify-center w-[28px] h-[28px] rounded-lg text-text-faint hover:text-text-muted hover:bg-white/[0.05] transition-all duration-150 cursor-pointer">
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

function ToolbarSep() {
  return <div className="w-px h-3.5 bg-white/[0.06] mx-1" />;
}

function Tb({ onClick, tip, children }: { onClick: () => void; tip: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className="flex items-center justify-center w-[28px] h-[28px] rounded-lg text-text-faint hover:text-text-muted hover:bg-white/[0.05] transition-all duration-150 cursor-pointer"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

function TypaLogo() {
  return (
    <div className="flex items-center justify-center w-[28px] h-[28px]" title="Typa">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 4C5.5 4 4 5.5 4 7v3c0 1-1 2-2 2 1 0 2 1 2 2v3c0 1.5 1.5 3 3 3" stroke="var(--cl-accent)" strokeWidth="2" />
        <path d="M17 4c1.5 0 3 1.5 3 3v3c0 1 1 2 2 2-1 0-2 1-2 2v3c0 1.5-1.5 3-3 3" stroke="var(--cl-accent)" strokeWidth="2" />
        <circle cx="9" cy="12" r="1.25" fill="var(--cl-accent)" />
        <circle cx="15" cy="12" r="1.25" fill="var(--cl-accent)" />
      </svg>
    </div>
  );
}

function SidebarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
      <path d="M0 3a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H2a2 2 0 01-2-2V3zm5-1v12h9a1 1 0 001-1V3a1 1 0 00-1-1H5zM4 2H2a1 1 0 00-1 1v10a1 1 0 001 1h2V2z" />
    </svg>
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
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M6 1v10M1 6h10" />
    </svg>
  );
}

function KeyboardIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
      <path d="M14 5a1 1 0 011 1v5a1 1 0 01-1 1H2a1 1 0 01-1-1V6a1 1 0 011-1h12zM2 4a2 2 0 00-2 2v5a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H2z" />
      <path d="M13 10.25a.25.25 0 01.25-.25h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5a.25.25 0 01-.25-.25v-.5zm0-2a.25.25 0 01.25-.25h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5a.25.25 0 01-.25-.25v-.5zm-5 0A.25.25 0 018.25 8h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5A.25.25 0 018 8.75v-.5zm2 0a.25.25 0 01.25-.25h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5a.25.25 0 01-.25-.25v-.5zm-2-2A.25.25 0 018.25 6h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5A.25.25 0 018 6.75v-.5zm2 0a.25.25 0 01.25-.25h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5a.25.25 0 01-.25-.25v-.5zm-2 4a.25.25 0 01.25-.25h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5A.25.25 0 018 10.75v-.5zm-6-4A.25.25 0 012.25 6h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5A.25.25 0 012 6.75v-.5zm0 2A.25.25 0 012.25 8h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5A.25.25 0 012 8.75v-.5zm2-2A.25.25 0 014.25 6h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5A.25.25 0 014 6.75v-.5zm0 2A.25.25 0 014.25 8h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5A.25.25 0 014 8.75v-.5zm-2 2A.25.25 0 012.25 10h1.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-1.5A.25.25 0 012 10.75v-.5zm2 0a.25.25 0 01.25-.25h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5a.25.25 0 01-.25-.25v-.5zm2-2A.25.25 0 016.25 8h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5A.25.25 0 016 8.75v-.5zm2 2a.25.25 0 01.25-.25h3.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-3.5a.25.25 0 01-.25-.25v-.5zm-4-2A.25.25 0 016.25 6h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5A.25.25 0 016 6.75v-.5zm8 0a.25.25 0 01.25-.25h1.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-1.5a.25.25 0 01-.25-.25v-.5zm-2 2a.25.25 0 01.25-.25h.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25h-.5a.25.25 0 01-.25-.25v-.5z" />
    </svg>
  );
}

function SunIcon() { return <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a.5.5 0 01.5.5v1a.5.5 0 01-1 0v-1A.5.5 0 018 1zm0 10a3 3 0 100-6 3 3 0 000 6zm0-1a2 2 0 110-4 2 2 0 010 4zm5.657-8.657a.5.5 0 010 .707l-.707.707a.5.5 0 11-.707-.707l.707-.707a.5.5 0 01.707 0zM3.757 11.243a.5.5 0 010 .707l-.707.707a.5.5 0 11-.707-.707l.707-.707a.5.5 0 01.707 0zM15 8a.5.5 0 01-.5.5h-1a.5.5 0 010-1h1A.5.5 0 0115 8zM3.5 8a.5.5 0 01-.5.5h-1a.5.5 0 010-1h1a.5.5 0 01.5.5zm9.193 4.243a.5.5 0 01-.707 0l-.707-.707a.5.5 0 01.707-.707l.707.707a.5.5 0 010 .707zM3.757 4.757a.5.5 0 01-.707 0l-.707-.707a.5.5 0 11.707-.707l.707.707a.5.5 0 010 .707zM8 13a.5.5 0 01.5.5v1a.5.5 0 01-1 0v-1A.5.5 0 018 13z" /></svg>; }
function MoonIcon() { return <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M6 .278a.768.768 0 01.08.858 7.21 7.21 0 00-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 01.81.316.733.733 0 01-.031.893A8.349 8.349 0 018.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 016 .278z" /></svg>; }
function MoreIcon() { return <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M3 9.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" /></svg>; }
