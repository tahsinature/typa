import { useCallback, useState } from "react";

/** Copies text to the clipboard and reports `copied` for a short moment. */
export function useCopy(resetAfterMs = 1200) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), resetAfterMs);
      });
    },
    [resetAfterMs],
  );
  return { copied, copy };
}
