import { CheckIcon, CopyIcon } from "./icons";
import { useCopy } from "./useCopy";

/** A line result. Hovering shows a pill; clicking copies the value. */
export function ResultPill({ result }: { result: string }) {
  const { copied, copy } = useCopy();
  return (
    <button
      type="button"
      onClick={() => copy(result)}
      title="Click to copy"
      className="group flex items-center gap-1.5 rounded-md px-2 -mr-2 h-full text-result tabular-nums whitespace-nowrap cursor-pointer transition-colors hover:bg-bg-hover"
    >
      <span className="opacity-0 group-hover:opacity-100 text-text-muted transition-opacity">
        {copied ? <CheckIcon /> : <CopyIcon />}
      </span>
      <span>{result}</span>
    </button>
  );
}
