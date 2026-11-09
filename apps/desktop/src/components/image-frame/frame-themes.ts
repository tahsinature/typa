export const BG_THEMES = [
  { id: "candy", name: "Candy", bg: "linear-gradient(140deg, #e879f9, #f472b6, #fb923c)" },
  { id: "oceanic", name: "Oceanic", bg: "linear-gradient(140deg, #06b6d4, #3b82f6, #8b5cf6)" },
  { id: "sunset", name: "Sunset", bg: "linear-gradient(140deg, #f97316, #ef4444, #ec4899)" },
  { id: "forest", name: "Forest", bg: "linear-gradient(140deg, #22c55e, #14b8a6, #06b6d4)" },
  { id: "midnight", name: "Midnight", bg: "linear-gradient(140deg, #6366f1, #8b5cf6, #a855f7)" },
  { id: "mono", name: "Mono", bg: "linear-gradient(140deg, #525252, #404040, #262626)" },
  { id: "crimson", name: "Crimson", bg: "linear-gradient(140deg, #dc2626, #b91c1c, #991b1b)" },
  { id: "aurora", name: "Aurora", bg: "linear-gradient(140deg, #4ade80, #2dd4bf, #818cf8)" },
] as const;

export type BgThemeId = (typeof BG_THEMES)[number]["id"];

export const PADDING_OPTIONS = [16, 32, 64, 128] as const;

/** Colors of the window card inside the frame. */
export function cardColors(darkMode: boolean) {
  return darkMode
    ? { background: "#121212", text: "#d4d4d4", muted: "rgba(255,255,255,0.35)", faint: "rgba(255,255,255,0.2)", divider: "rgba(255,255,255,0.08)", accent: "#4ade80", danger: "#f87171" }
    : { background: "#ffffff", text: "#1e1e1e", muted: "rgba(0,0,0,0.45)", faint: "rgba(0,0,0,0.25)", divider: "rgba(0,0,0,0.08)", accent: "#16a34a", danger: "#dc2626" };
}

export type CardColors = ReturnType<typeof cardColors>;
