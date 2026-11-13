import { DiagramNodeAction, DiagramNodeBadge, DiagramNodeHeader } from "@/components/diagram/DiagramNode";
import { TreeIcon } from "./icons";
import { formatCount } from "./model";

interface HierarchyDiagramHeaderProps {
  name: string;
  count?: number;
  countTitle?: string;
  group: boolean;
  collapsed: boolean;
  onToggle?: () => void;
  singleRow?: boolean;
}

export function HierarchyDiagramHeader({ name, count, countTitle, group, collapsed, onToggle, singleRow }: HierarchyDiagramHeaderProps) {
  return (
    <DiagramNodeHeader className="ht-card-header" style={singleRow ? { height: "100%", borderRadius: 9, borderBottom: 0 } : undefined}>
      {onToggle && (
        <DiagramNodeAction aria-label={`${collapsed ? "Expand" : "Collapse"} ${name}`} aria-expanded={!collapsed} onClick={(event) => { event.stopPropagation(); onToggle(); }}>
          <TreeIcon name="chevron" width={10} height={10} style={{ transform: collapsed ? undefined : "rotate(90deg)" }} />
        </DiagramNodeAction>
      )}
      <DiagramNodeBadge><TreeIcon name={group ? "tree" : "leaf"} width={12} height={12} /></DiagramNodeBadge>
      <span className="ht-card-title" title={name}>{name}</span>
      {count !== undefined && <span className="ht-card-count" title={countTitle}>{formatCount(count)}</span>}
    </DiagramNodeHeader>
  );
}
