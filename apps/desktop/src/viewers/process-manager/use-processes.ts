import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface ProcessInfo {
  pid: number;
  name: string;
  command: string;
  memory_bytes: number;
  start_time: number;
  protected: boolean;
}

interface ProcessSnapshot {
  processes: ProcessInfo[];
  can_stop: boolean;
}

export function useProcesses() {
  const [snapshot, setSnapshot] = useState<ProcessSnapshot>({ processes: [], can_stop: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<ProcessSnapshot>("scan_processes");
      if (currentRequest === requestId.current) setSnapshot(result);
    } catch (error) {
      if (currentRequest === requestId.current) setError(String(error));
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => { requestId.current += 1; };
  }, [refresh]);

  return { ...snapshot, loading, error, refresh };
}

export function formatProcessMemory(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
