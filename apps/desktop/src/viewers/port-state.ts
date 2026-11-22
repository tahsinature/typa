export function normalizeState(state: string): string {
  const s = state.toUpperCase().replace(/[^A-Z0-9_]/g, "");
  const map: Record<string, string> = {
    LISTEN: "LISTEN",
    LISTENING: "LISTEN",
    ESTABLISHED: "ESTABLISHED",
    ESTAB: "ESTABLISHED",
    CLOSE_WAIT: "CLOSE_WAIT",
    CLOSEWAIT: "CLOSE_WAIT",
    TIME_WAIT: "TIME_WAIT",
    TIMEWAIT: "TIME_WAIT",
    FIN_WAIT_1: "FIN_WAIT",
    FIN_WAIT_2: "FIN_WAIT",
    FINWAIT1: "FIN_WAIT",
    FINWAIT2: "FIN_WAIT",
    SYN_SENT: "SYN_SENT",
    SYN_RECV: "SYN_RECV",
    LAST_ACK: "LAST_ACK",
    CLOSING: "CLOSING",
  };
  return map[s] || s || "UNKNOWN";
}

export function filterPortStates<T extends { state: string }>(ports: T[], selected: string[]): T[] {
  return selected.length === 0 ? ports : ports.filter(port => selected.includes(normalizeState(port.state)));
}
