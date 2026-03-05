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

function ImageInputWidget({ input, onInputChange, theme }: { input: string; onInputChange: (value: string) => void; theme: "dark" | "light" }) {
  const isDark = theme === "dark";
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const hasImage = input.startsWith("data:image");

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const dataUrl = await fileToDataUrl(file);
      onInputChange(dataUrl);
    },
    [onInputChange],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) handleFile(file);
          return;
        }
      }
    },
    [handleFile],
  );

  return (
    <div
      className="h-full flex flex-col items-center justify-center p-4 select-none"
      style={{ backgroundColor: "var(--bg)" }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onPaste={handlePaste}
      tabIndex={0}
    >
      {hasImage ? (
        <div className="flex flex-col items-center gap-3 w-full h-full">
          <div className="flex-1 min-h-0 flex items-center justify-center w-full">
            <img src={input} alt="Input" className="max-w-full max-h-full object-contain rounded" style={{ border: `1px solid ${isDark ? "#2d2d30" : "#e5e5ea"}` }} />
          </div>
          <button
            onClick={() => onInputChange("")}
            className="text-[11px] px-2 py-1 rounded transition-colors"
            style={{
              color: "var(--cl-danger)",
              backgroundColor: isDark ? "rgba(255,69,58,0.1)" : "rgba(255,59,48,0.08)",
            }}
          >
            Remove
          </button>
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center gap-3 w-full h-full rounded-lg border-2 border-dashed transition-colors"
          style={{
            borderColor: dragOver ? "var(--cl-accent)" : isDark ? "#3c3c3c" : "#d1d1d6",
            backgroundColor: dragOver ? (isDark ? "rgba(0,122,255,0.05)" : "rgba(0,122,255,0.03)") : "transparent",
          }}
        >
          <ImageIcon />
          <div className="text-[12px] text-text-muted text-center">
            Drop an image, paste, or{" "}
            <button onClick={() => fileRef.current?.click()} className="text-accent hover:underline">
              browse
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>
      )}
    </div>
  );
}

registerInputWidget({
  id: "image-input",
  name: "Image Input",
  icon: ImageIcon,
  component: ImageInputWidget,
});
