import { useRef } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TreeIcon } from "./icons";
import { hierarchyExamples } from "./examples";

interface Props {
  ready: boolean;
  copied: boolean;
  exporting: boolean;
  canExport: boolean;
  onCopyJson: () => void;
  onExport: () => void;
  onImportSource: (source: string) => void;
  onNotice: (message: string) => void;
  onLoadExample: (source: string) => void;
}
/** Export button plus an overflow menu for import, copy, and examples. */
export function WorkspaceActions({ ready, copied, exporting, canExport, onCopyJson, onExport, onImportSource, onNotice, onLoadExample }: Props) {
  const importRef = useRef<HTMLInputElement>(null);
  return (
    <div className="ht-header-actions">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="ht-icon-button" aria-label="More actions" title="More actions">
            <TreeIcon name="more" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[200px]">
          <DropdownMenuItem onSelect={() => importRef.current?.click()}>
            <TreeIcon name="plus" className="mr-2" width={13} height={13} />
            Import file…
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!ready} onSelect={onCopyJson}>
            <TreeIcon name={copied ? "check" : "copy"} className="mr-2" width={13} height={13} />
            {copied ? "Copied JSON" : "Copy as JSON"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Load example (undo available)</DropdownMenuLabel>
          {hierarchyExamples.map((example) => (
            <DropdownMenuItem key={example.id} onSelect={() => onLoadExample(example.source)}>
              {example.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        type="button"
        className="ht-button ht-button-primary"
        aria-label={exporting ? "Exporting image" : "Export tree as PNG"}
        title="Export the current diagram, including expanded branches"
        disabled={!canExport || exporting}
        onClick={onExport}
        aria-busy={exporting}
      >
        <TreeIcon name="download" />
        <span>{exporting ? "Exporting…" : "Export"}</span>
      </button>
      <input
        ref={importRef}
        type="file"
        className="ht-file-input"
        accept=".txt,.md,.json,text/plain,application/json"
        aria-label="Import hierarchy file"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          if (file.size > 2_000_000) {
            onNotice("Choose a text or JSON file smaller than 2 MB.");
            return;
          }
          try {
            onImportSource(await file.text());
          } catch {
            onNotice("Unable to read this file. Try pasting its text into the source panel.");
          }
        }}
      />
    </div>
  );
}
