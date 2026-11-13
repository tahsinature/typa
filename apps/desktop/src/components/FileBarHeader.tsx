import { useState } from 'react';
import { useDocumentStore } from '@/stores/documentStore';
import { useSettingsStore } from '@/stores/settingsStore';

export function FileBarHeader() {
  const documents = useDocumentStore((s) => s.documents);
  const loaded = useDocumentStore((s) => s.loaded);
  const removeAllDocs = useDocumentStore((s) => s.removeAll);
  const refresh = useDocumentStore((s) => s.refresh);
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshError(false);
    try {
      await refresh();
    } catch {
      setRefreshError(true);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="shrink-0">
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
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh saved files"
            aria-busy={refreshing}
            title={refreshing ? 'Refreshing saved files…' : 'Refresh saved files'}
            className="flex items-center justify-center size-[20px] rounded-md text-text-faint hover:text-text-muted hover:bg-white/[0.06] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={refreshing ? 'animate-spin motion-reduce:animate-none' : undefined} aria-hidden="true">
              <path d="M20 7v5h-5" />
              <path d="M4 17v-5h5" />
              <path d="M6.1 7a7 7 0 0 1 11.55-2L20 12M4 12l2.35 7A7 7 0 0 0 17.9 17" />
            </svg>
          </button>
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
      {refreshError && (
        <p role="alert" className="px-3 py-2 text-[11px] text-danger">
          Couldn't refresh saved files. Try again.
        </p>
      )}
    </div>
  );
}
