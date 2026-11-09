import { invoke } from "@tauri-apps/api/core";

/** Writes actual image pixels to the system clipboard through the native backend. */
export async function copyCanvasToClipboard(canvas: HTMLCanvasElement): Promise<void> {
  const { width, height } = canvas;
  if (!width || !height) throw new Error("The image is empty");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not read the image");
  const image = context.getImageData(0, 0, width, height);
  await invoke("copy_image_to_clipboard", { rgba: Array.from(image.data), width, height });
}
