import { useEffect } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';

const SHORTCUT_GROUPS = [
  {
    label: 'Tabs',
    shortcuts: [
      { keys: '⌘ T', action: 'New tab' },
      { keys: '⌘ W', action: 'Close tab' },
      { keys: '⌘ 1-9', action: 'Switch to tab' },
      { keys: '⌘ ⇧ [', action: 'Previous tab' },
      { keys: '⌘ ⇧ ]', action: 'Next tab' },
    ],
  },
  {
    label: 'View',
    shortcuts: [
      { keys: '⌘ B', action: 'Toggle sidebar' },
      { keys: '⌘ L', action: 'Toggle layout' },
      { keys: '⌘ ⇧ ⏎', action: 'Toggle fullscreen' },
    ],
  },
  {
    label: 'Zoom',
    shortcuts: [
      { keys: '⌘ +', action: 'Zoom in' },
      { keys: '⌘ -', action: 'Zoom out' },
      { keys: '⌘ 0', action: 'Reset zoom' },
    ],
  },
  {
    label: 'Actions',
    shortcuts: [
      { keys: '⌘ K', action: 'Command palette' },
      { keys: '⌘ S', action: 'Save file' },
      { keys: '⌘ /', action: 'Keyboard shortcuts' },
    ],
  },
];

export function ShortcutsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm palette-overlay" />
        <DialogPrimitive.Content
          className="fixed z-[91] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 palette-content"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="w-[480px] max-h-[70vh] rounded-xl border border-border-subtle/60 bg-bg-elevated shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <h2 className="text-[13px] font-semibold text-text">Keyboard Shortcuts</h2>
              <div className="flex items-center gap-2">
                <kbd className="text-[10px] text-text-faint bg-white/[0.06] border border-white/[0.08] rounded px-1.5 py-0.5 font-mono">
                  ⌘ /
                </kbd>
                <button
                  onClick={onClose}
                  className="flex items-center justify-center size-[22px] rounded-md text-text-faint hover:text-text-muted hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  <svg width="10" height="10" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Shortcuts grid */}
            <div className="px-5 pb-5 grid grid-cols-2 gap-x-6 gap-y-5">
              {SHORTCUT_GROUPS.map((group) => (
                <div key={group.label}>
                  <div className="text-[9.5px] font-semibold text-text-faint tracking-[0.1em] uppercase mb-2">
                    {group.label}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {group.shortcuts.map((s) => (
                      <div
                        key={s.action}
                        className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-md hover:bg-white/[0.03] transition-colors"
                      >
                        <span className="text-[12px] text-text-secondary">{s.action}</span>
                        <kbd className="text-[10.5px] text-text-muted font-mono tracking-wide ml-3 shrink-0">
                          {s.keys}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
