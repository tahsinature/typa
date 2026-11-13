import type { TransformEmptyState } from '@typa/engine';

export function TransformEmptyOutput({ title, description, symbol }: TransformEmptyState) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center select-none">
      <span aria-hidden="true" className="font-mono text-[28px] leading-none text-text-faint">
        {symbol}
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-[13px] font-medium text-text-muted">{title}</p>
        <p className="text-[12px] text-text-faint">
          {description}
        </p>
      </div>
    </div>
  );
}
