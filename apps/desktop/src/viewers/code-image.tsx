import { useEffect, useState, useRef, useCallback } from "react";
import { createHighlighter, type Highlighter } from "shiki";
import { ImageFrame, Divider } from "@/components/image-frame/ImageFrame";
import { format as prettierFormat } from "prettier/standalone";
import prettierBabel from "prettier/plugins/babel";
import prettierEstree from "prettier/plugins/estree";
import prettierTs from "prettier/plugins/typescript";
import prettierHtml from "prettier/plugins/html";
import prettierCss from "prettier/plugins/postcss";
import prettierMarkdown from "prettier/plugins/markdown";
import prettierYaml from "prettier/plugins/yaml";
import prettierGraphql from "prettier/plugins/graphql";
import { IconButton } from "@/components/ui/icon-button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { registerViewer } from "./registry";

/* ── Highlighting ── */
const SHIKI_DARK_THEME = "vitesse-dark";
const SHIKI_LIGHT_THEME = "vitesse-light";

/* ── Language Detection ── */
const LANG_PATTERNS: [RegExp, string][] = [
  [/^\s*<(!DOCTYPE|html|div|span|head|body|script|style|link|meta|form|table|p\b|a\b|ul\b|li\b|h[1-6])/im, "html"],
  [/^\s*<\?php/m, "php"],
  [/<[A-Z][a-zA-Z]*[\s/>]|import\s+React|from\s+['"]react['"]|jsx|tsx/m, "tsx"],
  [/^(import|export)\s+.*(from\s+['"]|{)/m, "typescript"],
  [/:\s*(string|number|boolean|void|any)\b|interface\s+\w+|type\s+\w+\s*=/m, "typescript"],
  [/^(const|let|var|function|class|=>|===|!==|console\.)/m, "javascript"],
  [/^\s*\{[\s\S]*"[\w]+":\s/m, "json"],
  [/^---\n[\s\S]*?\n---/m, "yaml"],
  [/^\s*(def |class |import |from .* import|if __name__|print\()/m, "python"],
  [/^\s*(fn |let mut |impl |use |pub |struct |enum |mod |match )/m, "rust"],
  [/^\s*(func |package |import\s*\(|:=|go\s+func)/m, "go"],
  [/^\s*(public\s+class|private\s+|System\.out|@Override|import\s+java\.)/m, "java"],
  [/^\s*(#include|int\s+main|printf|scanf|void\s+\w+\(|->|::)/m, "cpp"],
  [/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|FROM|WHERE)\b/im, "sql"],
  [/^\s*(\$[\w]+\s*=|function\s+\w+\s*\(|echo\s|<?php)/m, "php"],
  [/^\s*(apiVersion:|kind:|metadata:|spec:)/m, "yaml"],
  [/^\s*[.#][\w-]+\s*\{|@media|@import|:root/m, "css"],
  [/^\s*\$[\w-]+:\s|@mixin|@include|@extend/m, "scss"],
  [/^\s*(FROM|RUN|CMD|COPY|EXPOSE|ENTRYPOINT|WORKDIR)\b/m, "dockerfile"],
  [/^#!/m, "bash"],
  [/^\s*([\w-]+)\s*=/m, "ini"],
];

function detectLanguage(code: string): string {
  for (const [pattern, lang] of LANG_PATTERNS) {
    if (pattern.test(code)) return lang;
  }
  return "plaintext";
}

const POPULAR_LANGUAGES: string[] = [
  "plaintext", "javascript", "typescript", "tsx", "jsx", "python", "rust", "go",
  "java", "cpp", "c", "csharp", "php", "ruby", "swift", "kotlin", "html",
  "css", "scss", "json", "yaml", "toml", "sql", "bash", "dockerfile",
  "markdown", "xml", "graphql", "prisma",
];

/* ── Highlighter Singleton ── */
let highlighterPromise: Promise<Highlighter> | null = null;
const loadedLanguages = new Set<string>();

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [SHIKI_DARK_THEME, SHIKI_LIGHT_THEME],
      langs: ["plaintext"],
    });
    loadedLanguages.add("plaintext");
  }
  return highlighterPromise;
}

async function ensureLanguage(hl: Highlighter, lang: string) {
  if (!loadedLanguages.has(lang)) {
    try {
      await hl.loadLanguage(lang as any);
      loadedLanguages.add(lang);
    } catch {}
  }
}

/* ── Prettier ── */
const PRETTIER_PARSERS: Record<string, { parser: string; plugins: any[] }> = {
  javascript: { parser: "babel", plugins: [prettierBabel, prettierEstree] },
  typescript: { parser: "typescript", plugins: [prettierTs, prettierEstree] },
  tsx: { parser: "typescript", plugins: [prettierTs, prettierEstree] },
  jsx: { parser: "babel", plugins: [prettierBabel, prettierEstree] },
  json: { parser: "json", plugins: [prettierBabel, prettierEstree] },
  html: { parser: "html", plugins: [prettierHtml] },
  css: { parser: "css", plugins: [prettierCss] },
  scss: { parser: "scss", plugins: [prettierCss] },
  markdown: { parser: "markdown", plugins: [prettierMarkdown] },
  yaml: { parser: "yaml", plugins: [prettierYaml] },
  graphql: { parser: "graphql", plugins: [prettierGraphql] },
};

async function formatCode(code: string, lang: string): Promise<string> {
  const entry = PRETTIER_PARSERS[lang];
  if (entry) {
    try {
      const result = await prettierFormat(code, {
        parser: entry.parser,
        plugins: entry.plugins,
        printWidth: 80,
        tabWidth: 2,
        singleQuote: true,
        trailingComma: "all",
      });
      return result.trimEnd();
    } catch (e) {
      console.error("Prettier format failed:", e);
    }
  }
  const lines = code.split("\n").map((l) => l.trimEnd());
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.map((l) => l.replace(/\t/g, "  ")).join("\n");
}

/* ── Toolbar Icons ── */
function HashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8.39 12.648a1 1 0 00-.015.18c0 .305.21.508.5.508.266 0 .492-.172.555-.477l.554-2.703h1.204c.421 0 .617-.234.617-.547 0-.312-.188-.53-.617-.53h-.985l.516-2.524h1.265c.43 0 .618-.227.618-.547 0-.313-.188-.524-.618-.524h-1.046l.476-2.304a1 1 0 00.016-.164.51.51 0 00-.516-.516.54.54 0 00-.539.43l-.523 2.554H7.617l.477-2.304c.008-.04.015-.118.015-.164a.51.51 0 00-.523-.516.54.54 0 00-.531.43L6.53 5.484H5.414c-.43 0-.617.22-.617.532s.187.539.617.539h.906l-.515 2.523H4.609c-.421 0-.609.219-.609.531s.188.547.61.547h.976l-.516 2.492c-.008.04-.015.125-.015.18 0 .305.21.508.5.508.265 0 .492-.172.554-.477l.555-2.703h2.242zm-1-6.109h2.266l-.515 2.563H6.859l.532-2.563z" />
    </svg>
  );
}
function FormatIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2.5 3a.5.5 0 000 1h11a.5.5 0 000-1h-11zM2.5 7a.5.5 0 000 1h7a.5.5 0 000-1h-7zM2.5 11a.5.5 0 000 1h11a.5.5 0 000-1h-11z" />
    </svg>
  );
}

/* ── Viewer Component ── */
function CodeImageViewer({ data, theme }: { data: string; theme: "dark" | "light" }) {
  const rawCode = data ?? "";
  const code = rawCode.split("\n").reduce((acc, line) => {
    if (acc.length === 0 && line.trim() === "") return acc;
    acc.push(line);
    return acc;
  }, [] as string[]).join("\n").trimEnd();

  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [language, setLanguage] = useState<string>("plaintext");
  const [autoDetected, setAutoDetected] = useState<string>("plaintext");
  const [isAuto, setIsAuto] = useState(true);
  const [formattedCode, setFormattedCode] = useState(code);
  const lastInputRef = useRef(code);

  useEffect(() => {
    if (code !== lastInputRef.current) {
      lastInputRef.current = code;
      setFormattedCode(code);
    }
  }, [code]);

  useEffect(() => {
    const detected = detectLanguage(formattedCode);
    setAutoDetected(detected);
    if (isAuto) setLanguage(detected);
  }, [formattedCode, isAuto]);

  const handleFormat = useCallback(async () => {
    setFormattedCode(await formatCode(formattedCode, language));
  }, [formattedCode, language]);

  if (!rawCode.trim()) {
    return (
      <div className="h-full flex items-center justify-center bg-bg">
        <span className="text-text-faint text-[13px]">Paste code in the input to generate an image</span>
      </div>
    );
  }

  return (
    <ImageFrame
      baseName="Code Image"
      theme={theme}
      contentKey={[showLineNumbers, language, formattedCode].join("|")}
      toolbarStart={
        <>
          <Divider />
          <IconButton tooltip="Toggle line numbers" active={showLineNumbers} onClick={() => setShowLineNumbers(!showLineNumbers)}><HashIcon /></IconButton>
          <LanguageDropdown
            language={language}
            isAuto={isAuto}
            autoDetected={autoDetected}
            onAuto={() => { setIsAuto(true); setLanguage(autoDetected); }}
            onSelect={(lang) => { setIsAuto(false); setLanguage(lang); }}
          />
        </>
      }
      toolbarEnd={<IconButton tooltip="Format code" onClick={handleFormat}><FormatIcon /></IconButton>}
    >
      {({ darkMode, colors }) => (
        <HighlightedCode code={formattedCode} language={language} darkMode={darkMode} showLineNumbers={showLineNumbers} textColor={colors.text} lineNumberColor={colors.faint} />
      )}
    </ImageFrame>
  );
}

function LanguageDropdown({ language, isAuto, autoDetected, onAuto, onSelect }: {
  language: string;
  isAuto: boolean;
  autoDetected: string;
  onAuto: () => void;
  onSelect: (language: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="h-[24px] px-2 rounded-md text-[11px] text-text-muted hover:text-text-secondary hover:bg-bg-hover/80 transition-colors cursor-pointer outline-none">
          {isAuto ? `Auto (${autoDetected})` : language}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[300px] overflow-auto">
        <DropdownMenuItem onClick={onAuto}>
          <span className={isAuto ? "text-accent font-medium" : ""}>Auto ({autoDetected})</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {POPULAR_LANGUAGES.map((l) => (
          <DropdownMenuItem key={l} onClick={() => onSelect(l)}>
            <span className={!isAuto && language === l ? "text-accent font-medium" : ""}>{l}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function HighlightedCode({ code, language, darkMode, showLineNumbers, textColor, lineNumberColor }: {
  code: string;
  language: string;
  darkMode: boolean;
  showLineNumbers: boolean;
  textColor: string;
  lineNumberColor: string;
}) {
  const [tokenLines, setTokenLines] = useState<{ content: string; color?: string }[][]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!code.trim()) { setTokenLines([]); return; }
      const hl = await getHighlighter();
      const lang = loadedLanguages.has(language) ? language : "plaintext";
      await ensureLanguage(hl, lang);
      const { tokens } = hl.codeToTokens(code, {
        lang: lang as any,
        theme: darkMode ? SHIKI_DARK_THEME : SHIKI_LIGHT_THEME,
      });
      if (!cancelled) {
        setTokenLines(tokens.map((line) => line.map((t) => ({ content: t.content, color: t.color }))));
      }
    })();
    return () => { cancelled = true; };
  }, [code, language, darkMode]);

  const lineCount = tokenLines.length || code.split("\n").length;

  return (
    <div style={{ padding: "0 16px 16px", display: "flex", gap: 16, overflow: "hidden", fontSize: 13, lineHeight: "1.6", fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace" }}>
      {showLineNumbers && (
        <div style={{ userSelect: "none", flexShrink: 0, textAlign: "right", color: lineNumberColor }}>
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} style={{ height: "1.6em" }}>{i + 1}</div>
          ))}
        </div>
      )}
      <div style={{ flex: 1, overflow: "hidden", color: textColor, whiteSpace: "pre" }}>
        {tokenLines.map((line, i) => (
          <div key={i} style={{ height: "1.6em" }}>
            {line.length === 0 ? "\n" : line.map((token, j) => (
              <span key={j} style={{ color: token.color }}>{token.content}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Icon ── */
function CodeImageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M6.002 5.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
      <path d="M2.002 1a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V3a2 2 0 00-2-2h-12zm12 1a1 1 0 011 1v6.5l-3.777-1.947a.5.5 0 00-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 00-.63.062L1.002 12V3a1 1 0 011-1h12z" />
    </svg>
  );
}

registerViewer({
  parse: (output) => output,
  id: "code-image",
  name: "Code Image",
  icon: CodeImageIcon,
  component: CodeImageViewer,
});
