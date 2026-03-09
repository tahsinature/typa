import { useMemo } from "react";
import { DiffIcon } from "@/components/Icons";
import { registerViewer } from "./registry";

interface DiffLine {
  type: "add" | "remove" | "context" | "header" | "hunk";
  content: string;
  oldLine?: number;
  newLine?: number;
}

function parseDiff(raw: string): DiffLine[] {
  const lines = raw.split("\n");
  const result: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    if (line.startsWith("===") || line.startsWith("---") || line.startsWith("+++")) {
      result.push({ type: "header", content: line });
    } else if (line.startsWith("@@")) {
      const match = line.match(/@@ -(\d+)/);
      if (match) {
        oldLine = parseInt(match[1]) - 1;
        const match2 = line.match(/\+(\d+)/);
        newLine = match2 ? parseInt(match2[1]) - 1 : oldLine;
      }
      result.push({ type: "hunk", content: line });
    } else if (line.startsWith("-")) {
      oldLine++;
      result.push({ type: "remove", content: line.slice(1), oldLine });
    } else if (line.startsWith("+")) {
      newLine++;
      result.push({ type: "add", content: line.slice(1), newLine });
    } else if (line.startsWith(" ")) {
      oldLine++;
      newLine++;
      result.push({ type: "context", content: line.slice(1), oldLine, newLine });
    } else if (line.startsWith("\\")) {
      // "\ No newline at end of file" — skip
    }
  }

  return result;
}

const colors = {
  dark: {
    addBg: "rgba(35, 134, 54, 0.15)",
    addBorder: "rgba(35, 134, 54, 0.4)",
    addText: "#7ee787",
    removeBg: "rgba(248, 81, 73, 0.15)",
    removeBorder: "rgba(248, 81, 73, 0.4)",
    removeText: "#ffa198",
    hunkBg: "rgba(56, 139, 253, 0.1)",
    hunkText: "#79c0ff",
    headerText: "#8b949e",
    lineNum: "#4a4a4e",
    lineNumActive: "#8b949e",
    border: "#2d2d30",
  },
  light: {
    addBg: "rgba(35, 134, 54, 0.1)",
    addBorder: "rgba(35, 134, 54, 0.3)",
    addText: "#116329",
    removeBg: "rgba(248, 81, 73, 0.1)",
    removeBorder: "rgba(248, 81, 73, 0.3)",
    removeText: "#82071e",
    hunkBg: "rgba(56, 139, 253, 0.08)",
    hunkText: "#0550ae",
    headerText: "#636366",
    lineNum: "#aeaeb2",
    lineNumActive: "#636366",
    border: "#e5e5ea",
  },
};

function DiffViewer({ data, theme }: { data: string; theme: "dark" | "light" }) {
  const lines = useMemo(() => parseDiff(data), [data]);
  const c = colors[theme];

  if (lines.length === 0) {
    return <div className="p-3 text-text-muted text-[13px]">No differences</div>;
  }

  return (
    <div className="h-full overflow-auto" style={{ backgroundColor: "var(--bg)" }}>
      <table
        className="w-full border-collapse text-[13px] leading-[20px]"
        style={{ fontFamily: "'SF Mono', 'Fira Code', monospace" }}
      >
        <tbody>
          {lines.map((line, i) => {
            if (line.type === "header") {
              return (
                <tr key={i}>
                  <td
                    colSpan={3}
                    className="px-3 py-0.5"
                    style={{ color: c.headerText, fontStyle: "italic" }}
                  >
                    {line.content}
                  </td>
                </tr>
              );
            }

            if (line.type === "hunk") {
              return (
                <tr key={i}>
                  <td
                    colSpan={3}
                    className="px-3 py-1"
                    style={{ backgroundColor: c.hunkBg, color: c.hunkText }}
                  >
                    {line.content}
                  </td>
                </tr>
              );
            }

            const bgColor =
              line.type === "add" ? c.addBg : line.type === "remove" ? c.removeBg : "transparent";
            const textColor =
              line.type === "add" ? c.addText : line.type === "remove" ? c.removeText : "inherit";
            const prefix = line.type === "add" ? "+" : line.type === "remove" ? "−" : " ";

            return (
              <tr key={i} style={{ backgroundColor: bgColor }}>
                <td
                  className="text-right select-none px-2 w-[1px] whitespace-nowrap"
                  style={{
                    color: c.lineNum,
                    borderRight: `1px solid ${c.border}`,
                    minWidth: 40,
                  }}
                >
                  {line.oldLine ?? ""}
                </td>
                <td
                  className="text-right select-none px-2 w-[1px] whitespace-nowrap"
                  style={{
                    color: c.lineNum,
                    borderRight: `1px solid ${c.border}`,
                    minWidth: 40,
                  }}
                >
                  {line.newLine ?? ""}
                </td>
                <td className="px-3 whitespace-pre-wrap" style={{ color: textColor }}>
                  <span
                    className="inline-block w-[12px] select-none"
                    style={{
                      color: line.type === "context" ? c.lineNum : textColor,
                      fontWeight: line.type !== "context" ? 600 : 400,
                    }}
                  >
                    {prefix}
                  </span>
                  {line.content}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

registerViewer({
  parse: (output) => output,
  id: "diff",
  name: "Diff View",
  icon: DiffIcon,
  component: DiffViewer,
});
