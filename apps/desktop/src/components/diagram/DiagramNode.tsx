import type { ButtonHTMLAttributes, ComponentProps, HTMLAttributes } from "react";
import { Handle } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { DIAGRAM_FONT } from "./diagram-style";
import "./diagram.css";

export type DiagramHighlight = "none" | "selected" | "match" | "active" | "focus";

/** Shared presentation only. Callers supply the meaning of headers, badges, rows and actions. */
export function DiagramNodeFrame({ highlight = "none", className, style, ...props }: HTMLAttributes<HTMLDivElement> & { highlight?: DiagramHighlight }) {
  return <div className={cn("diagram-node", className)} data-highlight={highlight} style={{ fontFamily: DIAGRAM_FONT, ...style }} {...props} />;
}

export function DiagramNodeHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("diagram-node-header", className)} {...props} />;
}

export function DiagramNodeBadge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("diagram-node-badge", className)} {...props} />;
}

export function DiagramNodeAction({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={cn("diagram-node-action nodrag nopan", className)} {...props} />;
}

export function DiagramNodeRow({ as: Tag = "div", className, ...props }: HTMLAttributes<HTMLElement> & { as?: "div" | "li" }) {
  return <Tag className={cn("diagram-node-row", className)} {...props} />;
}

export function DiagramHandle({ className, ...props }: ComponentProps<typeof Handle>) {
  return <Handle isConnectable={false} className={cn("diagram-handle", className)} {...props} />;
}
