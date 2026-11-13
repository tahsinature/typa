import { useMemo, type ComponentType } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { extractTableData } from "@/components/data-table/table-data";
import type { RowActionsConfig } from "@/components/data-table/RowActionsMenu";
import { TableIcon } from "@/components/Icons";
import { registerOutputView } from "./registry";

export type { RowAction, RowActionGroup, RowActionsConfig } from "@/components/data-table/RowActionsMenu";

function TableViewer({ data, rowActions }: { data: unknown; theme?: "dark" | "light"; rowActions?: RowActionsConfig }) {
  const tableData = useMemo(() => extractTableData(data), [data]);
  if (!tableData) return <div className="p-3 text-text-muted text-[13px]">Cannot render as table</div>;
  return <DataTable data={tableData} rowActions={rowActions} />;
}

/* ── Factory: create a table view with custom row actions ── */

export function createTableView(config: {
  id: string;
  name: string;
  icon?: ComponentType;
  parse?: (output: string, richData?: unknown) => unknown;
  rowActions: RowActionsConfig;
}) {
  registerOutputView({
    id: config.id,
    name: config.name,
    icon: config.icon ?? TableIcon,
    parse: config.parse ?? ((output, richData) => richData ?? JSON.parse(output)),
    component: ({ data, theme }: { data: unknown; theme: "dark" | "light" }) => (
      <TableViewer data={data} theme={theme} rowActions={config.rowActions} />
    ),
  });
}

/* ── Default table registration (no row actions) ── */

registerOutputView({
  parse: (output, richData) => richData ?? JSON.parse(output),
  id: "table",
  name: "Table View",
  icon: TableIcon,
  component: TableViewer,
});
