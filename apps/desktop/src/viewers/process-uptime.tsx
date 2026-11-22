export function formatProcessUptime(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "Unknown";
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${Math.floor(seconds % 60)}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export function ProcessUptime({ startTime, seconds }: { startTime: number | null; seconds: number | null }) {
  const started = startTime && startTime > 0 ? new Date(startTime * 1000).toLocaleString() : null;
  return (
    <span
      className="text-[11px] text-text-secondary font-mono whitespace-nowrap"
      title={started ? `Process started: ${started}. Uptime at last scan.` : "Process start time unavailable"}
    >
      {formatProcessUptime(seconds)}
    </span>
  );
}
