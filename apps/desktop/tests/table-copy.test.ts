import { afterEach, expect, test } from "bun:test";
import { createTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import { getVisibleData, serializeTable } from "../src/components/data-table/table-data";
import { copyTable, serializeHTML, serializeJSON, serializeMarkdown } from "../src/components/data-table/table-copy";

const columns = ["Item", "Calculation", "Result"];
const rows = [["Astor", "180+280", "460"], ["Skirt", "3325", "3,325"]];
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const originalClipboardItem = Object.getOwnPropertyDescriptor(globalThis, "ClipboardItem");

afterEach(() => {
  for (const [name, descriptor] of [["navigator", originalNavigator], ["ClipboardItem", originalClipboardItem]] as const) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

test("Markdown has headers, a separator, and display values", () => {
  expect(serializeMarkdown(columns, rows)).toBe("| Item | Calculation | Result |\n| --- | --- | --- |\n| Astor | 180+280 | 460 |\n| Skirt | 3325 | 3,325 |");
});

test("Markdown keeps pipes, backslashes, inline syntax, HTML and line breaks inside cells", () => {
  expect(serializeMarkdown(["A|B"], [["<tag> & *literal* `code` \\ |\r\nnext"]])).toBe(
    "| A\\|B |\n| --- |\n| &lt;tag&gt; &amp; \\*literal\\* \\`code\\` \\\\ \\|<br>next |",
  );
});

test("HTML escapes user content and preserves line breaks", () => {
  const html = serializeHTML(['"Header"'], [["<script>alert('x')</script>&\nnext"]]);
  expect(html).toContain("<thead><tr><th");
  expect(html).toContain("&quot;Header&quot;");
  expect(html).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;&amp;<br>next");
  expect(html).not.toContain("<script>");
  expect(html).toContain("<tbody><tr><td");
});

test("JSON uses visible column names and retains formatted cell text", () => {
  expect(JSON.parse(serializeJSON(columns, rows))).toEqual([
    { Item: "Astor", Calculation: "180+280", Result: "460" },
    { Item: "Skirt", Calculation: "3325", Result: "3,325" },
  ]);
  expect(JSON.parse(serializeJSON(["__proto__"], [["safe"]]))[0]).toHaveProperty("__proto__", "safe");
});

test("empty tables still export valid headers and JSON", () => {
  expect(serializeMarkdown(["Item"], [])).toBe("| Item |\n| --- |");
  expect(serializeHTML(["Item"], [])).toContain("<tbody></tbody>");
  expect(serializeJSON(["Item"], [])).toBe("[]");
});

test("CSV and Excel quote their delimiters, quotes and multiline values", () => {
  expect(serializeTable(["A"], [['a,b"c\nd']], "csv")).toBe('A\n"a,b""c\nd"');
  expect(serializeTable(["A"], [["a\tb\rc"]], "tsv")).toBe('A\n"a\tb\rc"');
});

test("every format uses the filtered, sorted rows and only visible data columns", () => {
  const table = createTable<Record<string, unknown>>({
    data: [{ Item: "Zebra", Result: "180", secret: "hidden" }, { Item: "Astor", Result: "460", secret: "hidden" }, { Item: "Excluded", Result: "0" }],
    columns: [{ accessorKey: "Item" }, { accessorKey: "Result" }, { accessorKey: "secret" }, { id: "_actions", accessorFn: () => "actions" }],
    state: { sorting: [{ id: "Item", desc: false }], columnFilters: [{ id: "Result", value: "0" }], columnVisibility: { secret: false }, globalFilter: "" },
    onStateChange() {},
    renderFallbackValue: null,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const visible = getVisibleData(table);
  expect(visible).toEqual({ cols: ["Item", "Result"], rows: [["Astor", "460"], ["Excluded", "0"], ["Zebra", "180"]] });
  table.setOptions(options => ({ ...options, state: { ...options.state, columnFilters: [{ id: "Item", value: "astor" }] } }));
  expect(getVisibleData(table)).toEqual({ cols: ["Item", "Result"], rows: [["Astor", "460"]] });
});

test("rich copy writes HTML and a spreadsheet-compatible plain-text fallback together", async () => {
  let payload: Record<string, Blob> | undefined;
  Object.defineProperty(globalThis, "ClipboardItem", { configurable: true, value: class { constructor(data: Record<string, Blob>) { payload = data; } } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { write: async (items: unknown[]) => expect(items).toHaveLength(1) } } });
  expect(await copyTable(columns, rows, "html")).toBe("copied");
  expect(await payload!["text/html"].text()).toBe(serializeHTML(columns, rows));
  expect(await payload!["text/plain"].text()).toBe(serializeTable(columns, rows, "tsv"));
});

test("rich copy falls back to plain text if the API is unavailable", async () => {
  Reflect.deleteProperty(globalThis, "ClipboardItem");
  let text = "";
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async (value: string) => { text = value; } } } });
  expect(await copyTable(columns, rows, "html")).toBe("plain-text");
  expect(text).toBe(serializeTable(columns, rows, "tsv"));
});

test.each(["csv", "tsv", "markdown", "json"] as const)("%s writes the expected text", async format => {
  let text = "";
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async (value: string) => { text = value; } } } });
  expect(await copyTable(columns, rows, format)).toBe("copied");
  expect(text).toBe(format === "markdown" ? serializeMarkdown(columns, rows) : format === "json" ? serializeJSON(columns, rows) : serializeTable(columns, rows, format));
});

test("clipboard failures propagate so the menu can report them", async () => {
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async () => { throw new Error("Permission denied"); } } } });
  await expect(copyTable(columns, rows, "csv")).rejects.toThrow("Permission denied");
});
