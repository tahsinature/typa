export function JsonEmptyOutput() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center select-none">
      <span aria-hidden="true" className="font-mono text-[28px] leading-none text-text-faint">
        {"{ }"}
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-[13px] font-medium text-text-muted">Ready for JSON</p>
        <p className="text-[12px] text-text-faint">
          Paste or type JSON on the left to see the result.
        </p>
      </div>
    </div>
  );
}
