import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** A faint "?" for lines that could not be evaluated; hover shows why. */
export function ErrorMarker({ message }: { message: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex items-center justify-center w-4 h-4 rounded-full border border-border-subtle text-[10px] leading-none text-text-faint cursor-help hover:text-text-muted hover:border-text-faint transition-colors">
          ?
        </span>
      </TooltipTrigger>
      <TooltipContent side="left">{message}</TooltipContent>
    </Tooltip>
  );
}
