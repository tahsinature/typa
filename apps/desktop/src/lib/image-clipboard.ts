import { invoke } from "@tauri-apps/api/core";

/** Writes actual image pixels to the system clipboard through the native backend. */
export async function copyCanvasToClipboard(canvas: HTMLCanvasElement): Promise<void> {
  const { width, height } = canvas;
  if (!width || !height) throw new Error("The image is empty");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not read the image");
  const { data } = context.getImageData(0, 0, width, height);
  // Sent as a binary body; a JSON number array is hundreds of MB for large images.
  await invoke("copy_image_to_clipboard", new Uint8Array(data.buffer), {
    headers: { width: String(width), height: String(height) },
  });
}

const MAX_EXPORT_PIXELS = 16_000_000;

/** Preferred export scale, reduced so large images stay within a pixel budget. */
export function exportScale(width: number, height: number, preferred = 2): number {
  return Math.min(preferred, Math.max(1, Math.sqrt(MAX_EXPORT_PIXELS / (width * height))));
}
