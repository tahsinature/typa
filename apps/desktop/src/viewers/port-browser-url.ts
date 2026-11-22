export interface BrowserPort {
  port: number;
  protocol: string;
  state: string;
  local_address: string;
}

export function getPortBrowserUrl(entry: BrowserPort): string | null {
  const state = entry.state.toUpperCase().replace(/[^A-Z_]/g, "");
  if (entry.protocol.toUpperCase() !== "TCP" || !["LISTEN", "LISTENING"].includes(state)) return null;
  if (!Number.isInteger(entry.port) || entry.port < 1 || entry.port > 65535) return null;

  const address = entry.local_address.trim();
  const suffix = `:${entry.port}`;
  if (!address.endsWith(suffix)) return null;
  let host = address.slice(0, -suffix.length);
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  if (host === "*" || host === "0.0.0.0") host = "127.0.0.1";
  // Scanners return numeric addresses. Reject malformed or scoped addresses
  // that browsers cannot represent as HTTP URLs.
  if (!host || !/^[\da-fA-F:.]+$/.test(host)) return null;

  try {
    const url = new URL(`http://${host.includes(":") ? `[${host}]` : host}:${entry.port}`);
    if (url.hostname === "[::]") url.hostname = "[::1]";
    return url.href;
  } catch {
    return null;
  }
}
