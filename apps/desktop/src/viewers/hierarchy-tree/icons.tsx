import type { SVGProps } from "react";

const paths = {
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  grip: "M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01",
  undo: "M3 10h11a6 6 0 0 1 0 12M3 10l6-6M3 10l6 6",
  redo: "M21 10H10a6 6 0 0 0 0 12M21 10l-6-6M21 10l-6 6",
  indent: "M10 5h11M10 12h11M10 19h11M2 8l4 4-4 4",
  outdent: "M10 5h11M10 12h11M10 19h11M6 8l-4 4 4 4",
  up: "m6 14 6-6 6 6",
  parent: "M9 14 4 9l5-5M20 20v-7a4 4 0 0 0-4-4H4",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7",
  tree: "M9 3h6v5H9zM3 16h6v5H3zM15 16h6v5h-6zM12 8v4M6 16v-4h12v4",
  right: "M4 4h6v6H4zM16 2h5v5h-5zM16 14h5v5h-5zM10 7h3v-3h3M13 7v10h3",
  down: "M9 2h6v5H9zM2 16h5v5H2zM16 16h5v5h-5zM12 7v5H4v4M12 12h7v4",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  close: "M6 6l12 12M6 18L18 6",
  chevron: "m9 5 7 7-7 7",
  expand: "M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5",
  collapse: "M3 8h5V3M21 8h-5V3M8 21v-5H3M16 21v-5h5",
  source: "m8 5-6 7 6 7M16 5l6 7-6 7M14 3l-4 18",
  copy: "M9 9h12v12H9zM15 9V3H3v12h6",
  download: "M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4",
  leaf: "M20 4C8 2 2 8 6 16s17 3 14-12ZM6 18l9-9",
  layers: "m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5",
  info: "M12 11v6m0-10h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  fit: "M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M8 8h8v8H8z",
  check: "m5 12 4 4L19 6",
  map: "m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5ZM9 3v16M15 5v16",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  panel: "M3 4h18v16H3zM9 4v16",
  help: "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3m.1 4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
} as const;

export type TreeIconName = keyof typeof paths;
export function TreeIcon({ name = "tree", ...props }: SVGProps<SVGSVGElement> & { name?: TreeIconName }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d={paths[name]} />
    </svg>
  );
}
