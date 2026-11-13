import { memo, type CSSProperties } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { DiagramHandle, DiagramNodeFrame, DiagramNodeRow } from "@/components/diagram/DiagramNode";
import { HierarchyDiagramHeader } from "./diagram-header";
import { BOARD_ROW_INDENT } from "@typa/engine";
import { TreeIcon } from "./icons";
import { formatCount, type CardRow, type GroupCardData } from "./model";

export const GroupCard = memo(function GroupCard({ data, selected }: NodeProps<Node<GroupCardData, "groupCard">>) {
  const { entry, sections } = data;
  const group = !!entry && entry.children.length > 0;
  return (
    <DiagramNodeFrame
      className="ht-card"
      highlight={selected || data.selectedRowId ? "selected" : data.match ? "match" : "none"}
      style={{ "--branch-color": data.color } as CSSProperties}
    >
      {data.targetPosition && <DiagramHandle type="target" position={data.targetPosition} />}
      {entry && (
        <HierarchyDiagramHeader
          name={entry.name}
          group={group}
          count={group || data.count !== 1 ? data.count : undefined}
          collapsed={data.collapsed}
          onToggle={group ? () => data.onToggle(entry.id) : undefined}
        />
      )}
      {sections.length > 0 && (
        <div className="ht-card-body">
          {sections.map(({ heading, columns }, index) => (
            <section key={heading?.entry.id ?? index} className="ht-card-section">
              {heading && (
                <ul className="ht-card-rows">
                  <CardRowItem row={heading} title selected={heading.entry.id === data.selectedRowId} onToggle={data.onToggle} onSelect={data.onSelect} />
                </ul>
              )}
              <div className="ht-card-columns">
                {columns.map((column, columnIndex) => (
                  <ul key={columnIndex} className="ht-card-rows">
                    {column.map((row) => (
                      <CardRowItem key={row.entry.id} row={row} selected={row.entry.id === data.selectedRowId} onToggle={data.onToggle} onSelect={data.onSelect} />
                    ))}
                  </ul>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </DiagramNodeFrame>
  );
});

interface CardRowItemProps {
  row: CardRow;
  /** Renders the row as a section heading. */
  title?: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}

function CardRowItem({ row, title = false, selected, onToggle, onSelect }: CardRowItemProps) {
  const { entry } = row;
  const group = entry.children.length > 0;
  return (
    <DiagramNodeRow as="li"
      className={`ht-card-row nodrag ${title ? "ht-card-section-title" : ""} ${group ? "is-group" : ""} ${selected ? "is-selected" : ""} ${row.match ? "is-match" : ""}`}
      style={{ paddingLeft: 6 + row.indent * BOARD_ROW_INDENT }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(entry.id);
      }}
    >
      {group ? (
        <button
          type="button"
          className={`ht-card-fold ${row.collapsed ? "" : "is-open"}`}
          aria-label={`${row.collapsed ? "Expand" : "Collapse"} ${entry.name}`}
          aria-expanded={!row.collapsed}
          onClick={(event) => {
            event.stopPropagation();
            onToggle(entry.id);
          }}
        >
          <TreeIcon name="chevron" width={10} height={10} />
        </button>
      ) : (
        <span className="ht-card-leaf" aria-hidden="true">
          <TreeIcon name="leaf" width={11} height={11} />
        </span>
      )}
      <span className="ht-card-row-name" title={entry.name}>
        {entry.name}
      </span>
      {(group || row.count !== 1) && <span className="ht-card-row-count">{formatCount(row.count)}</span>}
    </DiagramNodeRow>
  );
}
