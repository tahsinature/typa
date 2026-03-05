import { useState, useEffect } from "react";

interface ImageInfo {
  src: string;
  label: string;
}

interface LoadedInfo {
  label: string;
  format: string;
  width: number;
  height: number;
  sizeFormatted: string;
  aspectRatio: string;
}

function getFormatFromDataUrl(src: string): string {
  const match = src.match(/^data:image\/(\w+)/);
  return match ? match[1].toUpperCase() : "Unknown";
}

function getSizeFromDataUrl(src: string): string {
  const match = src.match(/base64,(.+)$/);
  if (!match) return "Unknown";
  const bytes = Math.ceil((match[1].length * 3) / 4);
  return bytes > 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    : `${(bytes / 1024).toFixed(1)} KB`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function getAspectRatio(w: number, h: number): string {
  const d = gcd(w, h);
  return `${w / d}:${h / d}`;
}

export function ImageDetailsTable({
  images,
  theme,
}: {
  images: ImageInfo[];
  theme: "dark" | "light";
}) {
  const isDark = theme === "dark";
  const [loaded, setLoaded] = useState<LoadedInfo[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      images.map(
        ({ src, label }) =>
          new Promise<LoadedInfo>((resolve) => {
            const img = new Image();
            img.onload = () => {
              resolve({
                label,
                format: getFormatFromDataUrl(src),
                width: img.width,
                height: img.height,
                sizeFormatted: getSizeFromDataUrl(src),
                aspectRatio: getAspectRatio(img.width, img.height),
              });
            };
            img.onerror = () => {
              resolve({ label, format: "Error", width: 0, height: 0, sizeFormatted: "—", aspectRatio: "—" });
            };
            img.src = src;
          }),
      ),
    ).then((results) => {
      if (!cancelled) setLoaded(results);
    });
    return () => { cancelled = true; };
  }, [images]);

  if (loaded.length === 0) return null;

  const rows = [
    { label: "Format", values: loaded.map((i) => i.format) },
    { label: "Dimensions", values: loaded.map((i) => `${i.width} × ${i.height}`) },
    { label: "Aspect Ratio", values: loaded.map((i) => i.aspectRatio) },
    { label: "File Size", values: loaded.map((i) => i.sizeFormatted) },
  ];

  return (
    <table
      className="w-full border-collapse text-[13px]"
      style={{ fontFamily: "'SF Mono', 'Fira Code', monospace" }}
    >
      <thead>
        <tr>
          <th
            className="text-left px-3 py-1.5 font-medium"
            style={{ backgroundColor: isDark ? "#282a2f" : "#f5f5f5", borderBottom: `1px solid ${isDark ? "#3c3c3c" : "#d1d1d6"}`, color: isDark ? "#a0a0a0" : "#636366" }}
          />
          {loaded.map((info) => (
            <th
              key={info.label}
              className="text-left px-3 py-1.5 font-medium"
              style={{ backgroundColor: isDark ? "#282a2f" : "#f5f5f5", borderBottom: `1px solid ${isDark ? "#3c3c3c" : "#d1d1d6"}`, color: isDark ? "#a0a0a0" : "#636366" }}
            >
              {info.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const allSame = row.values.length > 1 && row.values.every((v) => v === row.values[0]);
          return (
            <tr key={row.label}>
              <td className="px-3 py-1.5 font-medium" style={{ borderBottom: `1px solid ${isDark ? "#2d2d30" : "#e5e5ea"}`, color: isDark ? "#a0a0a0" : "#636366" }}>
                {row.label}
              </td>
              {row.values.map((val, i) => (
                <td
                  key={i}
                  className="px-3 py-1.5"
                  style={{
                    borderBottom: `1px solid ${isDark ? "#2d2d30" : "#e5e5ea"}`,
                    color: !allSame && row.values.length > 1 ? "var(--cl-danger)" : "inherit",
                  }}
                >
                  {val}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
