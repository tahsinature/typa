import { JsonViewer } from "@textea/json-viewer";
import { TreeIcon } from "@/components/Icons";
import { registerViewer } from "./registry";

function JsonTreeViewer({ data, theme }: { data: unknown; theme: "dark" | "light" }) {
  return (
    <div className="h-full overflow-auto p-3" style={{ backgroundColor: "var(--bg)" }}>
      <JsonViewer
        value={data}
        theme={theme === "dark" ? "dark" : "light"}
        rootName={false}
        defaultInspectDepth={3}
        enableClipboard
        displayDataTypes={false}
        style={{ backgroundColor: "transparent", fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 13 }}
      />
    </div>
  );
}

registerViewer({
  parse: (output) => JSON.parse(output),
  id: "json-tree",
  name: "Tree View",
  icon: TreeIcon,
  component: JsonTreeViewer,
});
