import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "./tooltip";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tooltip?: string;
  active?: boolean;
  variant?: "ghost" | "subtle";
  shortcut?: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ tooltip, active, variant = "ghost", shortcut, className, children, ...props }, ref) => {
    const base =
      "flex items-center justify-center w-[24px] h-[24px] rounded-md transition-all duration-150 outline-none cursor-pointer disabled:opacity-30 disabled:cursor-default";
    const variants = {
      ghost: active
        ? "text-accent bg-accent/12"
        : "text-text-muted hover:text-text-secondary hover:bg-bg-hover/80 active:bg-bg-active/60",
      subtle: active
        ? "text-accent bg-accent/12"
        : "text-text-faint hover:text-text-muted hover:bg-bg-hover/50 active:bg-bg-active/40",
    };

    const button = (
      <button ref={ref} className={`${base} ${variants[variant]} ${className ?? ""}`} {...props}>
        {children}
      </button>
    );

    if (!tooltip) return button;

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>
          {tooltip}
          {shortcut && <span className="ml-1.5 text-text-faint">{shortcut}</span>}
        </TooltipContent>
      </Tooltip>
    );
  },
);
