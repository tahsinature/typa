import { useRef } from "react";
import { TreeIcon } from "./icons";
import { ExamplePicker } from "./example-picker";

interface Props {
  sourceOpen: boolean;
  ready: boolean;
  copied: boolean;
  exporting: boolean;
  canExport: boolean;
  onToggleSource: () => void;
  onCopyJson: () => void;
  onExport: () => void;
  onImportSource: (source: string) => void;
  onNotice: (message: string) => void;
  onLoadExample: (source: string) => void;
}
export function WorkspaceHeader({ sourceOpen, ready, copied, exporting, canExport, onToggleSource, onCopyJson, onExport, onImportSource, onNotice, onLoadExample }: Props) {
  const importRef = useRef<HTMLInputElement>(null);
  return (
    <header className="ht-header">
      <div className="ht-title-lockup">
        <span className="ht-brand-mark">
          <TreeIcon width={22} height={22} />
        </span>
        <div>
          <div className="ht-eyebrow">Diagram workspace</div>
          <h1>Hierarchy Tree</h1>
        </div>
      </div>
      <div className="ht-header-actions">
        <ExamplePicker onLoad={onLoadExample} />
        <button type="button" aria-label="Outline editor panel" className={`ht-button ${sourceOpen ? "is-active" : ""}`} aria-pressed={sourceOpen} onClick={onToggleSource}>
          <TreeIcon name="source" />
          <span>Editor</span>
        </button>
        <button type="button" className="ht-button" aria-label="Import outline or JSON file" onClick={() => importRef.current?.click()}>
          <TreeIcon name="plus" />
          <span>Import</span>
        </button>
        <button type="button" className="ht-button" aria-label="Copy hierarchy as JSON" disabled={!ready} onClick={onCopyJson}>
          <TreeIcon name={copied ? "check" : "copy"} />
          <span>{copied ? "Copied" : "Copy JSON"}</span>
        </button>
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
          <span>{exporting ? "Exporting…" : "Export PNG"}</span>
        </button>
      </div>
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
    </header>
  );
}
