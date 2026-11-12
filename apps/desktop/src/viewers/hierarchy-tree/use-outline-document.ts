import { useEffect, useRef, useState } from "react";
import { parseHierarchy, readOutlineEntries, writeOutlineEntries, type OutlineEntry } from "@typa/engine";

interface Snapshot {
  source: string;
  entries: OutlineEntry[];
  focusId: string | null;
}
interface FocusRequest {
  id: string | null;
  sequence: number;
}
export function useOutlineDocument(source: string, onChange: (source: string, focusId?: string) => void) {
  const [document, setDocument] = useState<Snapshot>(() => ({ source, entries: readOutlineEntries(source), focusId: null }));
  const current = useRef(document);
  const history = useRef<{ past: Snapshot[]; future: Snapshot[] }>({ past: [], future: [] });
  const editGroup = useRef({ key: "", time: 0 });
  const [focusRequest, setFocusRequest] = useState<FocusRequest>({ id: null, sequence: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    if (source === current.current.source) return;
    history.current.past.push(current.current);
    history.current.past = history.current.past.slice(-100);
    history.current.future = [];
    editGroup.current.key = "";
    const next = { source, entries: readOutlineEntries(source), focusId: null };
    current.current = next;
    setDocument(next);
    setError("");
  }, [source]);

  function publish(next: Snapshot, requestFocus: boolean) {
    current.current = next;
    setDocument(next);
    setError("");
    const index = next.entries.findIndex((entry) => entry.id === next.focusId);
    onChange(next.source, index >= 0 ? `entry-${index}` : undefined);
    if (requestFocus) setFocusRequest((previous) => ({ id: next.focusId, sequence: previous.sequence + 1 }));
  }
  function save(next: Snapshot, group = "", requestFocus = false) {
    if (next.source === current.current.source && next.entries === current.current.entries) return;
    const now = Date.now();
    if (!group || group !== editGroup.current.key || now - editGroup.current.time > 1200) {
      history.current.past.push(current.current);
      history.current.past = history.current.past.slice(-100);
    }
    history.current.future = [];
    editGroup.current = { key: group, time: now };
    publish(next, requestFocus);
  }
  function commit(entries: OutlineEntry[] | null, focusId: string | null, options: { group?: string; focus?: boolean } = {}) {
    if (!entries) return false;
    try {
      const serialized = writeOutlineEntries(entries);
      const parsed = parseHierarchy(serialized);
      if (parsed.error) {
        setError(parsed.error);
        return false;
      }
      save({ source: serialized, entries, focusId }, options.group, options.focus);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to edit this branch.");
      return false;
    }
  }
  function undo() {
    const previous = history.current.past.pop();
    if (!previous) return;
    history.current.future.push(current.current);
    editGroup.current.key = "";
    publish(previous, true);
  }
  function redo() {
    const next = history.current.future.pop();
    if (!next) return;
    history.current.past.push(current.current);
    editGroup.current.key = "";
    publish(next, true);
  }
  function activate(id: string) {
    if (current.current.focusId === id) return;
    editGroup.current.key = "";
    const next = { ...current.current, focusId: id };
    current.current = next;
    setDocument(next);
  }
  return {
    document,
    focusRequest,
    error,
    commit,
    undo,
    redo,
    activate,
    canUndo: history.current.past.length > 0,
    canRedo: history.current.future.length > 0,
    breakEditGroup: () => {
      editGroup.current.key = "";
    },
    setError,
    editSource: (value: string) => save({ source: value, entries: readOutlineEntries(value), focusId: null }, "source"),
  };
}
export type OutlineDocument = ReturnType<typeof useOutlineDocument>;
