import { useEffect, useState, useId } from "react";
import mermaid from "mermaid";
import { registerViewer } from "./registry";

function MermaidViewer({ data, theme }: { data: string; theme: "dark" | "light" }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const renderKey = useId().replace(/:/g, "_");

  useEffect(() => {
    const code = data ?? "";
    if (!code.trim()) {
      setSvg("");
      setError(null);
      return;
    }

    mermaid.initialize({
      startOnLoad: false,
      theme: theme === "dark" ? "dark" : "default",
      securityLevel: "loose",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    });

    let cancelled = false;

    mermaid
      .render(`mermaid-${renderKey}`, code)
      .then(({ svg: rendered }) => {
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSvg("");
          setError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [data, theme, renderKey]);

  if (error) {
    return (
      <div className="h-full overflow-auto p-4" style={{ backgroundColor: "var(--bg)" }}>
        <div className="text-danger text-[13px] font-mono whitespace-pre-wrap">{error}</div>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="h-full flex items-center justify-center" style={{ backgroundColor: "var(--bg)" }}>
        <span className="text-text-faint text-[13px]">Enter Mermaid syntax to preview</span>
      </div>
    );
  }

  return (
    <div
      className="h-full overflow-auto p-4 flex items-start justify-center"
      style={{ backgroundColor: "var(--bg)" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function MermaidIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v4M8 6L4 10M8 6l4 4M4 10v4M12 10v4" />
      <circle cx="8" cy="2" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

registerViewer({
  parse: (output) => output,
  id: "mermaid",
  name: "Mermaid",
  icon: MermaidIcon,
  component: MermaidViewer,
});
