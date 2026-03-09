import { DiffEditor, type Monaco } from "@monaco-editor/react";
import { SideBySideIcon } from "@/components/Icons";
import { useTabStore } from "@/stores/tabStore";
import { registerViewer } from "./registry";

function defineThemes(monaco: Monaco) {
  monaco.editor.defineTheme("typa-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#212226",
      "editor.foreground": "#cccccc",
      "editorLineNumber.foreground": "#4a4a4e",
      "editorLineNumber.activeForeground": "#a0a0a0",
      "editor.lineHighlightBackground": "#2b2d32",
      "editor.selectionBackground": "#264f78",
      "editorCursor.foreground": "#aeafad",
      "editorGutter.background": "#212226",
      "editorWidget.background": "#282a2f",
      "editorWidget.border": "#35373d",
    },
  });

  monaco.editor.defineTheme("typa-light", {
    base: "vs",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#1d1d1f",
      "editorLineNumber.foreground": "#aeaeb2",
      "editorLineNumber.activeForeground": "#636366",
      "editor.lineHighlightBackground": "#f5f5f5",
      "editor.selectionBackground": "#b4d8fd",
      "editorCursor.foreground": "#007aff",
      "editorGutter.background": "#ffffff",
      "editorWidget.background": "#f5f5f5",
      "editorWidget.border": "#d1d1d6",
    },
  });
}

function VisualDiffViewer({ theme }: { data: string; theme: "dark" | "light" }) {
  const tab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const original = tab?.inputs[0] ?? "";
  const modified = tab?.inputs[1] ?? "";

  return (
    <DiffEditor
      original={original}
      modified={modified}
      language="plaintext"
      theme={theme === "dark" ? "typa-dark" : "typa-light"}
      beforeMount={defineThemes}
      options={{
        readOnly: true,
        minimap: { enabled: false },
        fontSize: 14,
        fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', ui-monospace, monospace",
        lineHeight: 22,
        padding: { top: 12, bottom: 12 },
        scrollBeyondLastLine: false,
        renderLineHighlight: "none",
        overviewRulerLanes: 0,
        overviewRulerBorder: false,
        automaticLayout: true,
        renderSideBySide: true,
        scrollbar: {
          vertical: "auto",
          horizontal: "auto",
          verticalScrollbarSize: 7,
          horizontalScrollbarSize: 7,
          useShadows: false,
        },
      }}
    />
  );
}

registerViewer({
  parse: (output) => output,
  id: "visual-diff",
  name: "Visual Diff",
  icon: SideBySideIcon,
  component: VisualDiffViewer,
});
