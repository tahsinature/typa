import type { Monaco } from "@monaco-editor/react";
import type { editor, languages, Position } from "monaco-editor";
import type { CalculatorVocabulary, CompletionItem, CompletionKind } from "@typa/engine";

export const CALC_LANGUAGE_ID = "typa-calc";

/** Completion sources per editor model, so each sheet suggests its own variables. */
const completionSources = new Map<string, () => CompletionItem[]>();

export function setCompletionSource(modelUri: string, source: () => CompletionItem[]) {
  completionSources.set(modelUri, source);
  return () => {
    completionSources.delete(modelUri);
  };
}

let registered = false;

export function registerCalcLanguage(monaco: Monaco, vocabulary: CalculatorVocabulary) {
  if (!registered) {
    registered = true;
    monaco.languages.register({ id: CALC_LANGUAGE_ID });
    monaco.languages.setLanguageConfiguration(CALC_LANGUAGE_ID, {
      comments: { lineComment: "//" },
      brackets: [["(", ")"]],
      autoClosingPairs: [{ open: "(", close: ")" }, { open: '"', close: '"' }],
    });
    monaco.languages.registerCompletionItemProvider(CALC_LANGUAGE_ID, {
      provideCompletionItems: (model: editor.ITextModel, position: Position) => {
        const source = completionSources.get(model.uri.toString());
        if (!source) return { suggestions: [] };
        const word = model.getWordUntilPosition(position);
        const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
        return {
          suggestions: source().map((item) => ({
            label: { label: item.label, description: item.detail },
            kind: completionKind(monaco, item.kind),
            insertText: item.insertText ?? item.label,
            filterText: item.filterText,
            range,
          })),
        };
      },
    });
  }
  // Re-applied whenever the vocabulary changes (e.g. after currency rates load).
  monaco.languages.setMonarchTokensProvider(CALC_LANGUAGE_ID, calcTokens(vocabulary));
}

function completionKind(monaco: Monaco, kind: CompletionKind): languages.CompletionItemKind {
  const kinds = monaco.languages.CompletionItemKind;
  switch (kind) {
    case "unit":
      return kinds.Unit;
    case "currency":
      return kinds.Value;
    case "function":
      return kinds.Function;
    case "constant":
      return kinds.Constant;
    case "variable":
      return kinds.Variable;
    default:
      return kinds.Keyword;
  }
}

function calcTokens(vocabulary: CalculatorVocabulary): languages.IMonarchLanguage {
  return {
    defaultToken: "",
    keywords: vocabulary.keywords,
    functions: vocabulary.functions,
    constants: vocabulary.constants,
    currencies: vocabulary.currencies,
    units: vocabulary.units,
    tokenizer: {
      root: [
        [/#.*$/, "calc.heading"],
        [/\/\/.*$/, "comment"],
        [/"[^"]*"/, "string"],
        [/[A-Za-z][\w ]*:(?=\s)/, "calc.label"],
        [/[A-Za-z_]\w*(?=\s*[+\-*/]?=(?!=))/, "calc.variable"],
        [/0x[0-9a-fA-F]+|0b[01]+|0o[0-7]+/, "number"],
        [/(\d[\d,]*(\.\d+)?|\.\d+)([eE][+-]?\d+)?/, "number"],
        [/[$€£¥₹₩₽₺₱฿₫₦₪৳]/, "calc.currency"],
        [
          /[A-Za-z_°µΩÅ′″][\w°µΩÅ²³′″]*/,
          {
            cases: {
              "@keywords": "keyword",
              "@functions": "function",
              "@constants": "constant",
              "@currencies": "calc.currency",
              "@units": "calc.unit",
              "@default": "identifier",
            },
          },
        ],
        [/[+\-*/^%=×÷·−!]/, "operator"],
        [/[()]/, "delimiter.bracket"],
      ],
    },
  };
}
