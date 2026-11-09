import { invoke } from "@tauri-apps/api/core";

export type ImageFileBaseName = "Canvas" | "Code Image" | "Calculation";

export interface ImageApp {
  name: string;
  path: string;
  /** Data URL of the app icon, empty when macOS could not provide one. */
  icon: string;
  isDefault: boolean;
}

/** Opens the native save panel with a name like "Canvas 2026-11-09 at 14.28.06.png" and writes the PNG. */
export async function saveImageFile(png: Blob, baseName: ImageFileBaseName): Promise<void> {
  await invoke("save_png_file", await bytesOf(png), { headers: { "file-name": imageFileName(baseName) } });
}

/** Writes the PNG to a temporary file and opens it with the given app. */
export async function openImageWith(png: Blob, baseName: ImageFileBaseName, app: ImageApp): Promise<void> {
  await invoke("open_image_with", await bytesOf(png), {
    headers: { "file-name": imageFileName(baseName), "app-path": app.path },
  });
}

let imageAppsRequest: Promise<ImageApp[]> | null = null;

/** Apps that can open PNG images, default app first. Loaded once per session. */
export function listImageApps(): Promise<ImageApp[]> {
  imageAppsRequest ??= invoke<(Omit<ImageApp, "icon"> & { icon: number[] })[]>("list_image_apps")
    .then((apps) => apps.map((app) => ({ ...app, icon: app.icon.length ? toDataUrl(app.icon) : "" })))
    .catch((error) => {
      imageAppsRequest = null;
      throw error;
    });
  return imageAppsRequest;
}

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

function toDataUrl(png: number[]): string {
  let binary = "";
  for (const byte of png) binary += String.fromCharCode(byte);
  return `data:image/png;base64,${btoa(binary)}`;
}

function imageFileName(baseName: ImageFileBaseName): string {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}.${pad(date.getMinutes())}.${pad(date.getSeconds())}`;
  return `${baseName} ${day} at ${time}.png`;
}
