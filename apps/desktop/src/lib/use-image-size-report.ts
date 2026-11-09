import { useEffect } from "react";
import { useTabId } from "@/lib/tab-context";
import { useImageInfoStore, type ImageInfo } from "@/stores/imageInfoStore";

const SETTLE_DELAY_MS = 800;

/**
 * Measures the exported PNG once edits settle and reports it to the status bar.
 * Re-measures when `createPng` or `changeKey` changes.
 */
export function useImageSizeReport(createPng: () => Promise<Blob>, changeKey: unknown): void {
  const tabId = useTabId();

  useEffect(() => {
    if (!tabId) return;
    const { setEntry, clearEntry } = useImageInfoStore.getState();
    const previous = useImageInfoStore.getState().byTab[tabId]?.info ?? null;
    setEntry(tabId, { info: previous, measuring: true });

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const info = await measurePng(await createPng());
        if (!cancelled) setEntry(tabId, { info, measuring: false });
      } catch {
        // Nothing to export yet (e.g. an empty canvas).
        if (!cancelled) setEntry(tabId, { info: null, measuring: false });
      }
    }, SETTLE_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tabId, createPng, changeKey]);

  useEffect(() => {
    if (!tabId) return;
    return () => useImageInfoStore.getState().clearEntry(tabId);
  }, [tabId]);
}

/** Reads width and height from the PNG header (IHDR chunk, bytes 16–23). */
async function measurePng(png: Blob): Promise<ImageInfo> {
  const header = new DataView(await png.slice(16, 24).arrayBuffer());
  return { width: header.getUint32(0), height: header.getUint32(4), bytes: png.size };
}
