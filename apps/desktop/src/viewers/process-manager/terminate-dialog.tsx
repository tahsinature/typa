import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { ProcessInfo } from "./use-processes";

export interface TerminationTarget {
  process: ProcessInfo;
  force: boolean;
}

export function TerminateDialog({ target, onClose, onSent }: {
  target: TerminationTarget;
  onClose: () => void;
  onSent: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { process, force } = target;
  const action = force ? "Force Kill" : "Stop";

  async function terminate() {
    setBusy(true);
    setError(null);
    try {
      await invoke("terminate_process", {
        pid: process.pid, startTime: process.start_time, force,
      });
      onSent(`${force ? "Force kill" : "Stop"} requested for ${process.name} (PID ${process.pid}). Refresh to check whether it has exited.`);
    } catch (error) {
      setError(String(error));
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="p-5 gap-4" showCloseButton={!busy}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById("cancel-process-termination")?.focus();
        }}>
        <DialogHeader>
          <DialogTitle>{action} {process.name || "process"}?</DialogTitle>
          <DialogDescription>
            {force
              ? "This immediately terminates the process. Unsaved work may be lost."
              : "This asks the process to exit. It may interrupt running tasks or affect other apps. If it stays running, you can use Force Kill."}
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0 text-text-secondary text-xs">
          <p className="font-mono">PID {process.pid}</p>
          <p className="mt-2 font-mono break-all max-h-32 overflow-auto">{process.command || "Command unavailable"}</p>
        </div>
        {error && <p role="alert" className="text-xs text-danger">{error}</p>}
        <DialogFooter>
          <button id="cancel-process-termination" disabled={busy} onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover focus-visible:outline-accent disabled:opacity-40">
            Cancel
          </button>
          <button disabled={busy} onClick={terminate}
            className="rounded-md px-3 py-1.5 text-xs text-danger border border-danger/30 hover:bg-danger/10 focus-visible:outline-accent disabled:opacity-40">
            {busy ? "Sending…" : action}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
