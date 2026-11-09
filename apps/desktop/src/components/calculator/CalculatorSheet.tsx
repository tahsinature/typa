import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MonacoEditor, { type Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { TypaEngine } from "@typa/engine";
import { useSettingsStore } from "@/stores/settingsStore";
import { useEngineStore } from "@/stores/engineStore";
import { defineMonacoThemes, sharedEditorOptions } from "@/lib/monaco";
import { CALC_LANGUAGE_ID, registerCalcLanguage, setCompletionSource } from "./calcLanguage";
import { ResultsOverlay } from "./ResultsOverlay";
import { SelectionFooter } from "./SelectionFooter";

interface CalculatorSheetProps {
  input: string;
  onInputChange: (value: string) => void;
  theme: "dark" | "light";
}

/** Numi-style sheet: expressions on the left, results right-aligned on the same line. */
export function CalculatorSheet({ input, onInputChange, theme }: CalculatorSheetProps) {
  const fontSize = useSettingsStore((s) => s.fontSize);
  const lineHeight = Math.round(fontSize * 1.6);
  const engine = useSheetEngine();
  const engineRef = useRef(engine);
  engineRef.current = engine;

  const monacoRef = useRef<Monaco | null>(null);
  const [editorInstance, setEditorInstance] = useState<editor.IStandaloneCodeEditor | null>(null);
  const [selectedLines, setSelectedLines] = useState<number[]>([]);

  const results = useMemo(() => engine.evaluateDocument(input), [engine, input]);
  const summary = useMemo(
    () => engine.summarize(selectedLines.length > 0 ? selectedLines : undefined),
    // `results` is listed because summarize reads the engine's last evaluation.
    [engine, results, selectedLines],
  );

  useEffect(() => {
    if (monacoRef.current) registerCalcLanguage(monacoRef.current, engine.getVocabulary());
  }, [engine]);

  const handleBeforeMount = useCallback((monaco: Monaco) => {
    defineMonacoThemes(monaco);
    registerCalcLanguage(monaco, engineRef.current.getVocabulary());
    monacoRef.current = monaco;
  }, []);

  const handleMount = useCallback((ed: editor.IStandaloneCodeEditor) => {
    setEditorInstance(ed);
    const model = ed.getModel();
    const removeSource = model ? setCompletionSource(model.uri.toString(), () => engineRef.current.getCompletions()) : undefined;
    const selectionListener = ed.onDidChangeCursorSelection(() => setSelectedLines(selectedLineNumbers(ed)));
    ed.onDidDispose(() => {
      removeSource?.();
      selectionListener.dispose();
    });
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="relative flex-1 min-h-0">
        <MonacoEditor
          value={input}
          language={CALC_LANGUAGE_ID}
          theme={theme === "dark" ? "typa-dark" : "typa-light"}
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          onChange={(v) => onInputChange(v ?? "")}
          options={{ ...sharedEditorOptions, fontSize, lineHeight }}
        />
        {editorInstance && (
          <div className="absolute inset-0 pointer-events-none" style={{ fontSize, fontFamily: sharedEditorOptions.fontFamily }}>
            <ResultsOverlay editor={editorInstance} results={results} lineHeight={lineHeight} />
          </div>
        )}
      </div>
      <SelectionFooter summary={summary} selected={selectedLines.length > 0} />
    </div>
  );
}

/** One engine per sheet so selection summaries and variables never mix between tabs. */
function useSheetEngine() {
  const rates = useEngineStore((s) => s.currencyRates);
  return useMemo(() => {
    const engine = new TypaEngine();
    if (rates) engine.setCurrencyRates(rates);
    return engine;
  }, [rates]);
}

/** Line numbers covered by non-empty selections, ignoring a trailing line selected only up to column 1. */
function selectedLineNumbers(ed: editor.IStandaloneCodeEditor): number[] {
  const lines = new Set<number>();
  for (const selection of ed.getSelections() ?? []) {
    if (selection.isEmpty()) continue;
    const end = selection.endColumn === 1 && selection.endLineNumber > selection.startLineNumber ? selection.endLineNumber - 1 : selection.endLineNumber;
    for (let line = selection.startLineNumber; line <= end; line++) lines.add(line);
  }
  return [...lines].sort((a, b) => a - b);
}
