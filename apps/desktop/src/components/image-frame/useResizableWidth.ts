import { useCallback, useEffect, useRef, useState } from "react";

const MIN_WIDTH = 320;
const MAX_WIDTH = 1200;

/** Width of a centered element resized by dragging handles on either side. */
export function useResizableWidth(initialWidth: number) {
  const [width, setWidth] = useState(initialWidth);
  const [dragging, setDragging] = useState<"left" | "right" | null>(null);
  const dragStart = useRef({ x: 0, width: 0 });

  const startDrag = useCallback((side: "left" | "right", event: React.MouseEvent) => {
    event.preventDefault();
    setDragging(side);
    dragStart.current = { x: event.clientX, width };
  }, [width]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: MouseEvent) => {
      const dx = event.clientX - dragStart.current.x;
      // The element is centered, so it grows on both sides: double the pointer movement.
      const delta = dragging === "right" ? dx : -dx;
      setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, dragStart.current.width + delta * 2)));
    };
    const onUp = () => setDragging(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  return { width, dragging, startDrag };
}
