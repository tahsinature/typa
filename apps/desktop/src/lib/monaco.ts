import type { Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

export function defineMonacoThemes(monaco: Monaco) {
  monaco.editor.defineTheme("typa-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#1e1f23",
      "editor.foreground": "#d4d4d4",
      "editorLineNumber.foreground": "#4a4a4e",
      "editorLineNumber.activeForeground": "#a0a0a0",
      "editor.lineHighlightBackground": "#2b2d32",
      "editor.selectionBackground": "#264f78",
      "editorCursor.foreground": "#aeafad",
      "editorGutter.background": "#1e1f23",
      "editorWidget.background": "#282a2f",
      "editorWidget.border": "#35373d",
    },
  });

  monaco.editor.defineTheme("typa-light", {
    base: "vs",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#fafafa",
      "editor.foreground": "#1d1d1f",
      "editorLineNumber.foreground": "#aeaeb2",
      "editorLineNumber.activeForeground": "#636366",
      "editor.lineHighlightBackground": "#f0f0f0",
      "editor.selectionBackground": "#b4d8fd",
      "editorCursor.foreground": "#007aff",
      "editorGutter.background": "#fafafa",
      "editorWidget.background": "#f5f5f5",
      "editorWidget.border": "#d1d1d6",
    },
  });
}

export const sharedEditorOptions: editor.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: false },
  fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', ui-monospace, monospace",
  fontWeight: "400",
  letterSpacing: 0.3,
  padding: { top: 12, bottom: 12 },
  lineDecorationsWidth: 12,
  scrollBeyondLastLine: false,
  wordWrap: "on",
  renderLineHighlight: "none",
  occurrencesHighlight: "off",
  selectionHighlight: false,
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  overviewRulerBorder: false,
  automaticLayout: true,
  cursorBlinking: "smooth",
  cursorSmoothCaretAnimation: "on",
  smoothScrolling: true,
  tabSize: 2,
  renderWhitespace: "none",
  guides: { indentation: false },
  lineNumbers: "on",
  lineNumbersMinChars: 3,
  glyphMargin: false,
  folding: false,
  scrollbar: {
    vertical: "auto",
    horizontal: "auto",
    verticalScrollbarSize: 6,
    horizontalScrollbarSize: 6,
    useShadows: false,
  },
};
