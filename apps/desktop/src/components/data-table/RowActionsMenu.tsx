import type { ComponentType } from "react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";

export interface RowAction {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  variant?: "default" | "danger";
  action: (row: Record<string, unknown>) => void | Promise<void>;
}

export interface RowActionGroup {
  label?: string;
  actions: RowAction[];
}

export type RowActionsConfig = (row: Record<string, unknown>) => RowActionGroup[];

export function RowActionsMenu({ row, groups }: { row: Record<string, unknown>; groups: RowActionGroup[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center justify-center size-6 rounded-md text-text-faint hover:text-text-secondary hover:bg-bg-hover transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {groups.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && <DropdownMenuSeparator />}
            {group.label && <DropdownMenuLabel>{group.label}</DropdownMenuLabel>}
            {group.actions.map((action) => (
              <DropdownMenuItem
                key={action.label}
                onClick={() => action.action(row)}
                className={action.variant === "danger" ? "text-danger focus:text-danger" : ""}
              >
                {action.icon && (
                  <action.icon className="mr-2 size-3.5" />
                )}
                {action.label}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
