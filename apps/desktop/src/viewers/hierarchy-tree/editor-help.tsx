import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TreeIcon } from "./icons";

const shortcuts: [keys: string, action: string][] = [
  ["↵", "New sibling"],
  ["⇧ ↵", "New child"],
  ["Tab · ⇧ Tab", "Indent · outdent"],
  ["↑ · ↓", "Previous · next row"],
  ["⌥ ←", "Jump to parent"],
  ["⌥ →", "Jump to first child"],
  ["⌥ ↑ · ⌥ ↓", "Move branch"],
  ["⌘ .", "Fold · unfold"],
  ["⌘ ⇧ ⌫", "Delete branch"],
  ["⌘ Z · ⌘ ⇧ Z", "Undo · redo"],
  ["Esc", "Leave the editor"],
];

export function EditorHelp() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="ht-icon-button" aria-label="Editor shortcuts and tips" title="Shortcuts and tips">
          <TreeIcon name="help" width={14} height={14} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="ht-help w-[280px]">
        <dl className="ht-help-keys">
          {shortcuts.map(([keys, action]) => (
            <div key={action}>
              <dt>{action}</dt>
              <dd>
                <kbd>{keys}</kbd>
              </dd>
            </div>
          ))}
        </dl>
        <ul className="ht-help-notes">
          <li>Drag the grip to move a branch before, after, or inside another node.</li>
          <li>Paste an indented list or JSON into a node to import a branch.</li>
          <li>Leaf quantities are editable; group totals are calculated. Ctrl works in place of ⌘.</li>
          <li>All data stays on your device.</li>
        </ul>
      </PopoverContent>
    </Popover>
  );
}
