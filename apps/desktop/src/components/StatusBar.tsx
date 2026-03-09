import { useTabStore } from '@/stores/tabStore';
import { getTransform } from '@typa/engine';

export function StatusBar() {
  const tab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const selectedTransformId = tab?.selectedTransformId ?? 'calculator';
  const transform = selectedTransformId !== 'calculator' ? getTransform(selectedTransformId) : null;
  const name = transform?.name ?? 'Calculator';
  const category = transform?.category ?? 'Math';
  const inputLines = (tab?.inputs[0] ?? '').split('\n').length;
  const outputLines = (tab?.output ?? '').split('\n').length;

  return (
    <div className="flex items-center justify-between h-[28px] px-3 bg-bg-titlebar border-t border-border-subtle select-none shrink-0">
      <div className="flex items-center gap-1.5 text-[11px] leading-none text-text-muted">
        <span className="text-text-faint">{category}</span>
        <span className="text-text-faint/40">/</span>
        <span>{name}</span>
      </div>
      <div className="flex items-center gap-3 text-[10px] leading-none text-text-faint tabular-nums">
        <span>{inputLines} {inputLines === 1 ? 'line' : 'lines'}</span>
        <span className="text-text-faint/40">|</span>
        <span>{outputLines} out</span>
      </div>
    </div>
  );
}
