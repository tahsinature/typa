import { serializeTable } from "./table-data";

export type TableCopyFormat = "tsv" | "csv" | "markdown" | "html" | "json";
export type TableCopyResult = "copied" | "plain-text";

function escapeHTML(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function serializeMarkdown(columns: string[], rows: string[][]): string {
  const escape = (value: string) => escapeHTML(value)
    .replace(/[\\`*_[\]{}()|]/g, "\\$&")
    .replace(/\r\n|\r|\n/g, "<br>");
  const row = (cells: string[]) => `| ${cells.map(escape).join(" | ")} |`;
  return [row(columns), row(columns.map(() => "---")), ...rows.map(row)].join("\n");
}

export function serializeHTML(columns: string[], rows: string[][]): string {
  const cell = (value: string, tag: "th" | "td") =>
    `<${tag} style="border:1px solid #ccc;padding:6px 12px;text-align:left;white-space:pre-wrap">${escapeHTML(value).replace(/\r\n|\r|\n/g, "<br>")}</${tag}>`;
  const header = `<thead><tr>${columns.map((value) => cell(value, "th")).join("")}</tr></thead>`;
  const body = `<tbody>${rows.map((row) => `<tr>${row.map((value) => cell(value, "td")).join("")}</tr>`).join("")}</tbody>`;
  return `<table style="border-collapse:collapse">${header}${body}</table>`;
}

/** Export cell text as displayed, including formatted numbers and units. */
export function serializeJSON(columns: string[], rows: string[][]): string {
  return JSON.stringify(rows.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index]]))), null, 2);
}

export async function copyTable(columns: string[], rows: string[][], format: TableCopyFormat): Promise<TableCopyResult> {
  if (format === "html") {
    const plainText = serializeTable(columns, rows, "tsv");
    const richTextSupported = typeof ClipboardItem !== "undefined" && typeof navigator.clipboard.write === "function"
      && (typeof ClipboardItem.supports !== "function" || ClipboardItem.supports("text/html"));
    if (!richTextSupported) {
      await navigator.clipboard.writeText(plainText);
      return "plain-text";
    }
    await navigator.clipboard.write([new ClipboardItem({
      "text/html": new Blob([serializeHTML(columns, rows)], { type: "text/html" }),
      "text/plain": new Blob([plainText], { type: "text/plain" }),
    })]);
    return "copied";
  }

  const text = format === "markdown" ? serializeMarkdown(columns, rows)
    : format === "json" ? serializeJSON(columns, rows)
    : serializeTable(columns, rows, format);
  await navigator.clipboard.writeText(text);
  return "copied";
}
