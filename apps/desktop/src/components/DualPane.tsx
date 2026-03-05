import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { Allotment } from "allotment";
import MonacoEditor, { type Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { JsonViewer } from "@textea/json-viewer";
import { getAllTransforms, getTransform } from "@typa/engine";
import { useTabStore } from "@/stores/tabStore";
import { useDocumentStore } from "@/stores/documentStore";
import { useEngineStore } from "@/stores/engineStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { CodeIcon, TreeIcon } from "@/components/Icons";

// Access Monaco's internal QuickInputService by walking the parent chain
function getQuickInputService(ed: editor.IStandaloneCodeEditor): any {
  let current = (ed as any)?._instantiationService;
  let depth = 0;

  while (current && depth < 10) {
    const entries = current._services?._entries;
    if (entries instanceof Map) {
      for (const [key, entry] of entries) {
        const instance = entry?.instance ?? entry;
        if (instance && typeof instance.createQuickPick === "function") {
          return instance;
        }
        // Also check if it's a descriptor with a factory that hasn't been instantiated
        if (String(key).includes("quickInput")) {
          try {
            const svc = current.invokeFunction?.((accessor: any) => accessor.get(key));
            if (svc && typeof svc.createQuickPick === "function") {
              return svc;
            }
          } catch {}
        }
      }
    }
    current = current._parent;
    depth++;
  }

  return null;
}

function openTransformPicker(ed: editor.IStandaloneCodeEditor, currentId: string, onSelect: (id: string) => void) {
  const quickInput = getQuickInputService(ed);
  if (!quickInput) return;

  const picker = quickInput.createQuickPick();
  picker.placeholder = "Select a transform...";
  picker.matchOnDescription = true;

  // Build items grouped by category
  const categories = new Map<string, Array<{ id: string; name: string; category: string }>>();
  categories.set("Math", [{ id: "calculator", name: "Calculator", category: "Math" }]);
  for (const t of getAllTransforms()) {
    const list = categories.get(t.category) ?? [];
    list.push({ id: t.id, name: t.name, category: t.category });
    categories.set(t.category, list);
  }

  const items: any[] = [];
  for (const [category, transforms] of categories) {
    items.push({ type: "separator", label: category });
    for (const t of transforms) {
      items.push({
        label: t.name,
        description: t.id === currentId ? "$(check) Active" : "",
        _transformId: t.id,
      });
    }
  }

  picker.items = items;
  picker.onDidAccept(() => {
    const [selected] = picker.selectedItems;
    if (selected?._transformId) {
      onSelect(selected._transformId);
    }
    picker.hide();
  });
  picker.onDidHide(() => picker.dispose());
  picker.show();
}

function openFilePicker(ed: editor.IStandaloneCodeEditor) {
  const quickInput = getQuickInputService(ed);
  if (!quickInput) return;

  const docs = useDocumentStore.getState().documents;
  const tabs = useTabStore.getState().tabs;

  const picker = quickInput.createQuickPick();
  picker.placeholder = "Open a saved file...";
  picker.matchOnDescription = true;

  picker.items = docs.map((doc: any) => {
    const isOpen = tabs.some((t: any) => t.id === doc.id);
    return {
      label: doc.name,
      description: isOpen ? "Already open" : new Date(doc.updatedAt).toLocaleDateString(),
      _docId: doc.id,
    };
  });

  picker.onDidAccept(() => {
    const [selected] = picker.selectedItems;
    if (selected?._docId) {
      const doc = docs.find((d: any) => d.id === selected._docId);
      if (!doc) return;

      const store = useTabStore.getState();
      const existingTab = store.tabs.find((t) => t.id === doc.id);
      if (existingTab) {
        useTabStore.setState({ activeTabId: existingTab.id });
      } else {
        store.tabs.push({
          id: doc.id,
          label: doc.name,
          input: doc.input,
          output: doc.output,
          selectedTransformId: doc.selectedTransformId,
        });
        useTabStore.setState({ tabs: [...store.tabs], activeTabId: doc.id });
      }
    }
    picker.hide();
  });
  picker.onDidHide(() => picker.dispose());
  picker.show();
}

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

const sharedOptions: editor.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: false },
  fontSize: 14,
  fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', ui-monospace, monospace",
  fontWeight: "400",
  lineHeight: 22,
  letterSpacing: 0.3,
  padding: { top: 12, bottom: 12 },
  lineDecorationsWidth: 16,
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
    verticalScrollbarSize: 7,
    horizontalScrollbarSize: 7,
    useShadows: false,
  },
};

export function DualPane() {
  const activeTabId = useTabStore((s) => s.activeTabId);
  const tab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const updateInput = useTabStore((s) => s.updateInput);
  const updateOutput = useTabStore((s) => s.updateOutput);
  const setSelectedTransform = useTabStore((s) => s.setSelectedTransform);
  const resolvedTheme = useSettingsStore((s) => s.resolvedTheme);

  const inputEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const outputEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [viewerMode, setViewerMode] = useState(false);
  const input = tab?.input ?? "";
  const output = tab?.output ?? "";
  const selectedTransformId = tab?.selectedTransformId ?? "calculator";

  // Transforms that support a custom viewer
  const hasViewer = selectedTransformId === "json-format" || selectedTransformId === "json-minify";

  // Parse JSON for the viewer (only when needed)
  const parsedJson = useMemo(() => {
    if (!viewerMode || !hasViewer) return null;
    try {
      return JSON.parse(output);
    } catch {
      return null;
    }
  }, [viewerMode, hasViewer, output]);

  // Run the active transform on input
  const runTransform = useCallback(
    async (transformId: string, text: string) => {
      if (transformId === "calculator") {
        const engine = useEngineStore.getState().engine;
        const results = engine.evaluateDocument(text);
        const outputLines = text.split("\n").map((_, i) => {
          const r = results[i];
          if (!r || r.result === null) return "";
          return String(r.result);
        });
        updateOutput(activeTabId, outputLines.join("\n"));
      } else {
        const transform = getTransform(transformId);
        if (!transform) return;
        try {
          const result = await transform.fn(text);
          updateOutput(activeTabId, result);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          updateOutput(activeTabId, `Error: ${msg}`);
        }
      }
    },
    [activeTabId, updateOutput],
  );

  // Re-run transform when input or selected transform changes
  useEffect(() => {
    runTransform(selectedTransformId, input);
  }, [input, selectedTransformId, runTransform]);

  const handleInputChange = (value: string | undefined) => {
    updateInput(activeTabId, value ?? "");
  };

  const openPicker = useCallback(
    (ed: editor.IStandaloneCodeEditor) => {
      const state = useTabStore.getState();
      const currentId = state.tabs.find((t) => t.id === state.activeTabId)?.selectedTransformId ?? "calculator";
      openTransformPicker(ed, currentId, (id) => {
        const tabId = useTabStore.getState().activeTabId;
        setSelectedTransform(tabId, id);
      });
    },
    [setSelectedTransform],
  );

  // Listen for global events (fired from App.tsx when editor isn't focused)
  useEffect(() => {
    const handleTransformPicker = () => {
      const ed = inputEditorRef.current;
      if (ed) {
        ed.focus();
        openPicker(ed);
      }
    };
    const handleFilePicker = () => {
      const ed = inputEditorRef.current;
      if (ed) {
        ed.focus();
        openFilePicker(ed);
      }
    };
    window.addEventListener("typa:open-transform-picker", handleTransformPicker);
    window.addEventListener("typa:open-file-picker", handleFilePicker);
    return () => {
      window.removeEventListener("typa:open-transform-picker", handleTransformPicker);
      window.removeEventListener("typa:open-file-picker", handleFilePicker);
    };
  }, [openPicker]);

  const setupEditor = useCallback(
    (ed: editor.IStandaloneCodeEditor, monaco: Monaco) => {
      // Disable Monaco's built-in F1 command palette
      ed.addCommand(monaco.KeyCode.F1, () => {});

      // Add "Select Transform" to context menu + bind ⌘K / ⌘⇧P
      ed.addAction({
        id: "typa.openTransformPicker",
        label: "Select Transform",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP],
        contextMenuGroupId: "1_modification",
        contextMenuOrder: 99,
        run: () => openPicker(ed),
      });

      // Add "Open Saved File" + bind ⌘P
      ed.addAction({
        id: "typa.openFilePicker",
        label: "Open Saved File",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP],
        contextMenuGroupId: "1_modification",
        contextMenuOrder: 100,
        run: () => openFilePicker(ed),
      });
    },
    [openPicker],
  );

  const handleInputMount = (ed: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    inputEditorRef.current = ed;
    setupEditor(ed, monaco);
  };

  const handleOutputMount = (ed: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    outputEditorRef.current = ed;
    setupEditor(ed, monaco);
  };

  const theme = resolvedTheme === "dark" ? "typa-dark" : "typa-light";

  return (
    <Allotment>
      <Allotment.Pane>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-3 h-[30px] shrink-0 border-b border-border-subtle">
            <span className="text-[11px] text-text-muted font-medium">INPUT</span>
          </div>
          <div className="flex-1">
            <MonacoEditor value={input} defaultLanguage="plaintext" theme={theme} beforeMount={defineThemes} onMount={handleInputMount} onChange={handleInputChange} options={sharedOptions} />
          </div>
        </div>
      </Allotment.Pane>

      <Allotment.Pane>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-3 h-[30px] shrink-0 border-b border-border-subtle">
            <span className="text-[11px] text-text-muted font-medium">
              OUTPUT
              <span className="ml-1.5 font-normal text-text-faint">— {selectedTransformId === "calculator" ? "Calculator" : (getTransform(selectedTransformId)?.name ?? selectedTransformId)}</span>
            </span>
            <div className="flex items-center gap-1.5">
              {hasViewer && (
                <button
                  onClick={() => setViewerMode(!viewerMode)}
                  className={`flex items-center justify-center w-[22px] h-[22px] rounded transition-colors ${
                    viewerMode ? "text-accent bg-accent-soft" : "text-text-faint hover:text-text-muted"
                  }`}
                  title={viewerMode ? "Switch to plain text" : "Switch to tree view"}
                >
                  {viewerMode ? <CodeIcon /> : <TreeIcon />}
                </button>
              )}
              <button
                onClick={() => window.dispatchEvent(new Event("typa:open-transform-picker"))}
                className="text-[10px] text-text-faint hover:text-text-muted transition-colors"
              >
                ⌘K for transforms
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            {viewerMode && parsedJson !== null ? (
              <div className="h-full overflow-auto p-3" style={{ backgroundColor: "var(--bg)" }}>
                <JsonViewer
                  value={parsedJson}
                  theme={resolvedTheme === "dark" ? "dark" : "light"}
                  rootName={false}
                  defaultInspectDepth={3}
                  enableClipboard
                  displayDataTypes={false}
                  style={{ backgroundColor: "transparent", fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 13 }}
                />
              </div>
            ) : (
              <MonacoEditor
                value={output}
                defaultLanguage="plaintext"
                theme={theme}
                beforeMount={defineThemes}
                onMount={handleOutputMount}
                options={{
                  ...sharedOptions,
                  readOnly: true,
                  renderLineHighlight: "none",
                }}
              />
            )}
          </div>
        </div>
      </Allotment.Pane>
    </Allotment>
  );
}
