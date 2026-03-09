import { useRef, useCallback, useState } from "react";
import MonacoEditor, { type Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useSettingsStore } from "@/stores/settingsStore";
import { defineMonacoThemes, sharedEditorOptions } from "@/lib/monaco";
import { WrapIcon, ClearIcon, PasteIcon } from "@/components/Icons";
import { IconButton } from "@/components/ui/icon-button";
import { registerInputView } from "./registry";

function CodeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function RawInputView({ input, onInputChange, theme }: { input: string; onInputChange: (value: string) => void; theme: "dark" | "light" }) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [wrap, setWrap] = useState(true);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const monacoTheme = theme === "dark" ? "typa-dark" : "typa-light";

  const handleMount = useCallback((ed: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = ed;
    ed.addCommand(monaco.KeyCode.F1, () => {});
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-end px-2 h-[28px] shrink-0 border-b border-border-subtle/50">
        <div className="flex items-center gap-0.5">
          <IconButton
            tooltip="Paste from clipboard"
            onClick={async () => {
              const text = await navigator.clipboard.readText();
              if (text) onInputChange(text);
            }}
          >
            <PasteIcon />
          </IconButton>
          <IconButton
            tooltip="Clear input"
            onClick={() => onInputChange("")}
          >
            <ClearIcon />
          </IconButton>
          <IconButton
            tooltip={wrap ? "Disable word wrap" : "Enable word wrap"}
            active={wrap}
            onClick={() => {
              const next = !wrap;
              setWrap(next);
              editorRef.current?.updateOptions({ wordWrap: next ? "on" : "off" });
            }}
          >
            <WrapIcon />
          </IconButton>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <MonacoEditor
          value={input}
          defaultLanguage="plaintext"
          theme={monacoTheme}
          beforeMount={defineMonacoThemes}
          onMount={handleMount}
          onChange={(v) => onInputChange(v ?? "")}
          options={{
            ...sharedEditorOptions,
            fontSize,
            lineHeight: Math.round(fontSize * 1.6),
            wordWrap: wrap ? "on" : "off",
          }}
        />
      </div>
    </div>
  );
}

registerInputView({
  id: "raw-input",
  name: "Text Editor",
  icon: CodeIcon,
  component: RawInputView,
});
