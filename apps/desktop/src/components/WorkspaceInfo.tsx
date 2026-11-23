import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useTabStore } from "@/stores/tabStore";
import { FileIcon, InfoIcon, LayoutHorizontalIcon } from "@/components/Icons";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface WorkspaceInfoProps {
  tabId: string | null;
  transformer: string;
  description?: string;
  inputPanel: string;
  outputPanel: string;
  preset?: string;
  inToolbar?: boolean;
}

/** Keep the details beside their source state, placing only the trigger in the toolbar. */
export function WorkspaceInfo({ tabId, inToolbar = true, ...details }: WorkspaceInfoProps) {
  const isActive = useTabStore((s) => s.activeTabId === tabId);
  const [toolbar, setToolbar] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setToolbar(document.getElementById("workspace-info-trigger"));
  }, []);

  // Unmount inactive popovers so their portals cannot remain open over another tab.
  if (!isActive) return null;
  const popover = <WorkspaceInfoPopover {...details} />;
  return inToolbar ? (toolbar ? createPortal(popover, toolbar) : null) : popover;
}

function WorkspaceInfoPopover({ transformer, description, inputPanel, outputPanel, preset }: Omit<WorkspaceInfoProps, "tabId" | "inToolbar">) {
  const titleId = useId();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton
          type="button"
          aria-label="Workspace info"
          title="Workspace info"
          className="focus-visible:ring-2 focus-visible:ring-accent"
        >
          <InfoIcon />
        </IconButton>
      </PopoverTrigger>
      <PopoverContent aria-labelledby={titleId} className="w-[320px] max-w-[calc(100vw-24px)] !p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">Transformer</p>
        <h2 id={titleId} className="mt-1 text-[17px] font-semibold leading-snug text-text break-words">{transformer}</h2>
        <dl className="mt-4 grid grid-cols-2 gap-2">
          <PanelTile label="Input panel" value={inputPanel} />
          <PanelTile label="Output panel" value={outputPanel} output />
          {preset && (
            <div className="col-span-2 flex items-baseline justify-between gap-3 rounded-md border border-border-subtle/60 px-3 py-2">
              <dt className="shrink-0 text-[11px] text-text-muted">Preset</dt>
              <dd className="min-w-0 text-right text-[12px] font-medium text-text break-words">{preset}</dd>
            </div>
          )}
        </dl>
        {description && (
          <p className="mt-3 border-t border-border-subtle/60 pt-3 text-[11px] leading-relaxed text-text-secondary break-words">{description}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

function PanelTile({ label, value, output = false }: { label: string; value: string; output?: boolean }) {
  const absent = value === "None";
  return (
    <div className="min-w-0 rounded-lg border border-border-subtle/60 bg-bg-surface/60 px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-[10px] font-medium text-text-muted">
        <span aria-hidden="true" className={absent ? "text-text-muted" : "text-accent"}>
          {output ? <LayoutHorizontalIcon /> : <FileIcon />}
        </span>
        {label}
      </dt>
      <dd className={`mt-2 break-words leading-snug ${absent ? "text-[11px] text-text-secondary" : "text-[13px] font-semibold text-text"}`}>
        {absent ? "No separate panel" : value}
      </dd>
    </div>
  );
}
