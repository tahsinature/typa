import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { IconButton } from "@/components/ui/icon-button";
import { getPortBrowserUrl, type BrowserPort } from "./port-browser-url";

export function PortBrowserButton({ port }: { port: BrowserPort }) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = getPortBrowserUrl(port);
  if (!url) return null;

  const openBrowser = async () => {
    setOpening(true);
    setError(null);
    try {
      await invoke("open_browser_url", { url });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <IconButton
        type="button"
        title={`Open in browser: ${url}`}
        aria-label={`Open port ${port.port} in browser`}
        disabled={opening}
        onClick={openBrowser}
      >
        <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
        </svg>
      </IconButton>
      {error && <span role="alert" title={error} className="text-[11px] text-danger">Could not open browser</span>}
    </div>
  );
}
