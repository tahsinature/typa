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

  const tab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const selectedTransformId = tab?.selectedTransformId ?? 'calculator';
  const transform = selectedTransformId !== 'calculator' ? getTransform(selectedTransformId) : null;
  const name = transform?.name ?? 'Calculator';
  const category = transform?.category ?? 'Math';
  const meta = CATEGORY_META[category];

  return (
    <div className="flex items-center h-[38px] bg-bg-titlebar shrink-0 border-b border-border-subtle">
      {/* Traffic lights */}
      <div className="w-[78px] h-full shrink-0 drag-region" data-tauri-drag-region />

      {/* Center — active transform name */}
      <div className="flex-1 h-full drag-region flex items-center justify-center" data-tauri-drag-region>
        <div className="flex items-center gap-2 pointer-events-none select-none">
          <span
            className="size-[7px] rounded-full shrink-0"
            style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}40` }}
          />
          <span className="text-[11.5px] text-text-muted font-medium tracking-wide">
            <span className="text-text-faint">{category}</span>
            <span className="text-text-faint/30 mx-1.5">/</span>
            <span className="text-text-secondary">{name}</span>
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2.5 shrink-0 no-drag">
        <Tb onClick={() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })); }} tip="Switch transform ⌘K">
          <TransformIcon />
        </Tb>

        <div className="w-px h-3 bg-border-subtle mx-0.5" />

        <Tb onClick={toggleLayout} tip={layout === 'vertical' ? 'Side-by-side' : 'Stacked'}>
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

function SunIcon() { return <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a.5.5 0 01.5.5v1a.5.5 0 01-1 0v-1A.5.5 0 018 1zm0 10a3 3 0 100-6 3 3 0 000 6zm0-1a2 2 0 110-4 2 2 0 010 4zm5.657-8.657a.5.5 0 010 .707l-.707.707a.5.5 0 11-.707-.707l.707-.707a.5.5 0 01.707 0zM3.757 11.243a.5.5 0 010 .707l-.707.707a.5.5 0 11-.707-.707l.707-.707a.5.5 0 01.707 0zM15 8a.5.5 0 01-.5.5h-1a.5.5 0 010-1h1A.5.5 0 0115 8zM3.5 8a.5.5 0 01-.5.5h-1a.5.5 0 010-1h1a.5.5 0 01.5.5zm9.193 4.243a.5.5 0 01-.707 0l-.707-.707a.5.5 0 01.707-.707l.707.707a.5.5 0 010 .707zM3.757 4.757a.5.5 0 01-.707 0l-.707-.707a.5.5 0 11.707-.707l.707.707a.5.5 0 010 .707zM8 13a.5.5 0 01.5.5v1a.5.5 0 01-1 0v-1A.5.5 0 018 13z" /></svg>; }
function MoonIcon() { return <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M6 .278a.768.768 0 01.08.858 7.21 7.21 0 00-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 01.81.316.733.733 0 01-.031.893A8.349 8.349 0 018.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 016 .278z" /></svg>; }
function MoreIcon() { return <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M3 9.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" /></svg>; }
