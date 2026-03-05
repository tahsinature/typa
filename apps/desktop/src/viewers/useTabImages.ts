import { useTabStore } from "@/stores/tabStore";

export function useTabImages() {
  const tab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const a = tab?.inputs[0] ?? "";
  const b = tab?.inputs[1] ?? "";
  const hasA = a.startsWith("data:image");
  const hasB = b.startsWith("data:image");
  return { imageA: hasA ? a : null, imageB: hasB ? b : null };
}
