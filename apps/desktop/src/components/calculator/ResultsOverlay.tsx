import { useEffect, useReducer } from "react";
import type { editor } from "monaco-editor";
import type { LineResult } from "@typa/engine";
import { ResultPill } from "./ResultPill";
import { ErrorMarker } from "./ErrorMarker";

interface ResultsOverlayProps {
  editor: editor.IStandaloneCodeEditor;
  results: LineResult[];
  lineHeight: number;
}

/** Right-aligned results drawn over the editor, one per source line. */
export function ResultsOverlay({ editor, results, lineHeight }: ResultsOverlayProps) {
  useRerenderOnViewChange(editor);

  const scrollTop = editor.getScrollTop();
  const { height, verticalScrollbarWidth } = editor.getLayoutInfo();

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ right: verticalScrollbarWidth + 16 }}>
      {results.map((line) => {
        if (!line.result && !line.error) return null;
        const top = editor.getTopForLineNumber(line.line) - scrollTop;
        if (top < -lineHeight || top > height) return null;
        return (
          <div
            key={line.line}
            className="absolute right-0 flex items-center pointer-events-auto pl-6 bg-gradient-to-r from-transparent via-bg to-bg"
            style={{ top, height: lineHeight }}
          >
            {line.result ? <ResultPill result={line.result} /> : <ErrorMarker message={line.error ?? ""} />}
          </div>
        );
      })}
    </div>
  );
}

function useRerenderOnViewChange(editor: editor.IStandaloneCodeEditor) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const subscriptions = [
      editor.onDidScrollChange(() => bump()),
      editor.onDidLayoutChange(() => bump()),
      editor.onDidContentSizeChange(() => bump()),
    ];
    return () => subscriptions.forEach((s) => s.dispose());
  }, [editor]);
}
