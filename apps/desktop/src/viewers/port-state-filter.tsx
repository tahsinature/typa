import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuGroup, DropdownMenuItem, DropdownMenuCheckboxItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { normalizeState } from "./port-state";

interface PortStateFilterProps {
  ports: { state: string }[];
  selected: string[];
  onChange: (states: string[]) => void;
}

export function PortStateFilter({ ports, selected, onChange }: PortStateFilterProps) {
  const counts = new Map<string, number>();
  for (const port of ports) {
    const state = normalizeState(port.state);
    counts.set(state, (counts.get(state) ?? 0) + 1);
  }
  // Keep selected states available to deselect if they disappear after refresh.
  const states = [...new Set([...counts.keys(), ...selected])].sort();
  const label = selected.length === 0 ? "All states" : selected.length === 1 ? selected[0] : `${selected.length} states`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Filter by state: ${label}`} className="inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-md border border-border-subtle bg-bg-input px-2 text-[12px] text-text-secondary hover:bg-bg-hover focus-visible:outline focus-visible:outline-accent">
          {label}
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>State · counts from last scan</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => onChange([])}>
            All states <span className="ml-auto pl-4 tabular-nums text-text-faint">{ports.length}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {states.map(state => (
            <DropdownMenuCheckboxItem
              key={state}
              checked={selected.includes(state)}
              onSelect={event => event.preventDefault()}
              onCheckedChange={checked => onChange(checked ? [...selected, state] : selected.filter(value => value !== state))}
            >
              {state}
              <span className="ml-auto pl-4 tabular-nums text-text-faint">{counts.get(state) ?? 0}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
