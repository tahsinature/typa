import { useState, useRef, useCallback } from "react";
import { ImageIcon } from "@/components/Icons";
import { registerInputWidget } from "./registry";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function parseImages(input: string): string[] {
  if (!input) return [];
  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) return parsed.filter((s: string) => s.startsWith("data:image"));
  } catch {}
  if (input.startsWith("data:image")) return [input];
  return [];
}

function MultiImageInputWidget({ input, onInputChange, theme }: { input: string; onInputChange: (value: string) => void; theme: "dark" | "light" }) {
  const isDark = theme === "dark";
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const images = parseImages(input);

  const addImages = useCallback(
    async (files: File[]) => {
      const newUrls: string[] = [];
      for (const file of files) {
        if (file.type.startsWith("image/")) {
          newUrls.push(await fileToDataUrl(file));
        }
      }
      if (newUrls.length > 0) {
        onInputChange(JSON.stringify([...images, ...newUrls]));
      }
    },
    [images, onInputChange],
  );

  const removeImage = useCallback(
    (index: number) => {
      const next = images.filter((_, i) => i !== index);
      onInputChange(next.length > 0 ? JSON.stringify(next) : "");
    },
    [images, onInputChange],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      addImages(Array.from(e.dataTransfer.files));
    },
    [addImages],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const files: File[] = [];
      for (const item of e.clipboardData.items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) addImages(files);
    },
    [addImages],
  );

  return (
    <div
      className="h-full flex flex-col select-none overflow-hidden"
      style={{ backgroundColor: "var(--bg)" }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onPaste={handlePaste}
      tabIndex={0}
    >
      {images.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <div
            className="flex flex-col items-center justify-center gap-3 w-full h-full rounded-lg border-2 border-dashed transition-colors"
            style={{
              borderColor: dragOver ? "var(--cl-accent)" : isDark ? "#3c3c3c" : "#d1d1d6",
              backgroundColor: dragOver ? (isDark ? "rgba(0,122,255,0.05)" : "rgba(0,122,255,0.03)") : "transparent",
            }}
          >
            <ImageIcon />
            <div className="text-[12px] text-text-muted text-center">
              Drop images, paste, or{" "}
              <button onClick={() => fileRef.current?.click()} className="text-accent hover:underline cursor-pointer">
                browse
              </button>
            </div>
            <div className="text-[10px] text-text-faint">Supports multiple images</div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto p-2">
          <div className="grid grid-cols-3 gap-2">
            {images.map((src, i) => (
              <div
                key={i}
                className="relative group rounded-md overflow-hidden border border-border-subtle"
                style={{ aspectRatio: "1" }}
              >
                <img src={src} alt={`Image ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  ×
                </button>
                <div className="absolute bottom-1 left-1 text-[9px] text-white bg-black/50 px-1 rounded">
                  {i + 1}
                </div>
              </div>
            ))}
            {/* Add more button */}
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center rounded-md border-2 border-dashed transition-colors cursor-pointer"
              style={{
                aspectRatio: "1",
                borderColor: isDark ? "#3c3c3c" : "#d1d1d6",
              }}
            >
              <span className="text-text-faint text-[20px]">+</span>
            </button>
          </div>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addImages(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
    </div>
  );
}

registerInputWidget({
  id: "multi-image-input",
  name: "Image Input",
  icon: ImageIcon,
  component: MultiImageInputWidget,
});
