import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

/** Primary "Export" button that saves the current image as a PNG. */
export function ImageExportButton({ onExport }: { onExport: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onExport}
          className="h-[24px] px-2.5 rounded-md text-[11px] font-medium text-white bg-accent hover:bg-accent-hover transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 1v10M4 8l4 4 4-4M2 14h12" />
          </svg>
          Export
        </button>
      </TooltipTrigger>
      <TooltipContent>Save as PNG</TooltipContent>
    </Tooltip>
  );
}
