import { useState, useCallback } from 'react';
import { useTabStore } from '@/stores/tabStore';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatExecTime(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function StatusBar() {
  const tab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const [copied, setCopied] = useState(false);

  const inputText = tab?.inputs[0] ?? '';
  const output = tab?.output ?? '';
  const execMs = tab?.lastExecMs ?? null;

  const chars = inputText.length;
  const words = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;
  const lines = inputText.split('\n').length;

  const outputBytes = new TextEncoder().encode(output).length;

  const handleCopy = useCallback(() => {
    if (!output) return;
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [output]);

  return (
    <div className="flex items-center justify-between h-[24px] px-3.5 bg-bg-titlebar border-t border-border-subtle select-none shrink-0 relative">
      {/* Left — input stats */}
      <div className="flex items-center gap-2.5 text-[10px] leading-none text-text-faint tabular-nums tracking-wide">
        <span>{chars.toLocaleString()} chars</span>
        <Dot />
        <span>{words.toLocaleString()} words</span>
        <Dot />
        <span>{lines} {lines === 1 ? 'line' : 'lines'}</span>
      </div>

      {/* Center — execution time */}
      <div className="absolute left-1/2 -translate-x-1/2 text-[10px] leading-none text-text-faint/60 tabular-nums tracking-wide">
        {execMs !== null && (
          <span>{formatExecTime(execMs)}</span>
        )}
      </div>

      {/* Right — output size + copy */}
      <div className="flex items-center gap-2.5 text-[10px] leading-none text-text-faint tabular-nums tracking-wide">
        {output && (
          <>
            <span>{formatBytes(outputBytes)}</span>
            <Dot />
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-text-faint hover:text-text-muted transition-colors duration-150 cursor-pointer"
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Dot() {
  return <span className="text-text-faint/30 text-[8px]">·</span>;
}

function CopyIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--cl-result)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
