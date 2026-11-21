export type Protocol = "TCP" | "UDP";
export type Scope = "all" | "localhost" | "specific";

export interface PortRow {
  port: number;
  protocol: Protocol;
  pid: number;
  command: string;
  user: string;
  /** Local addresses it is bound to, as lsof prints them ("*", "127.0.0.1", "[::1]"…). */
  addresses: string[];
  scope: Scope;
  ipv4: boolean;
  ipv6: boolean;
}

/** "*:3000" / "127.0.0.1:5432" / "[::1]:8080" / "127.0.0.1:53->10.0.0.1:99" → local host + port; null for "*:*". */
export function parseName(name: string): { host: string; port: number } | null {
  const local = name.split("->")[0];
  const m = /^(\[[^\]]+\]|[^:]+|\*):(\d+)$/.exec(local);
  if (!m) return null;
  return { host: m[1], port: Number(m[2]) };
}

export function scopeOf(host: string): Scope {
  const h = host.replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  if (h === "*" || h === "0.0.0.0" || h === "::") return "all";
  if (h === "::1" || h.startsWith("127.") || h === "localhost") return "localhost";
  return "specific";
}

const SCOPE_RANK: Record<Scope, number> = { all: 2, specific: 1, localhost: 0 };

/**
 * Parses `lsof -F pcuLPnT` output: process sets (p, c, u, L) followed by file sets (f, P, n, T…).
 * Keeps TCP sockets in LISTEN and bound UDP sockets; merges the IPv4 + IPv6 entries of one process/port.
 */
export function parseLsof(out: string): PortRow[] {
  const rows = new Map<string, PortRow>();
  let proc = { pid: 0, command: "", uid: "", login: "" };
  let file: { protocol?: string; name?: string; state?: string } | null = null;

  const flush = () => {
    if (!file?.protocol || !file.name) return;
    const protocol = file.protocol.toUpperCase();
    if (protocol !== "TCP" && protocol !== "UDP") return;
    if (protocol === "TCP" && file.state && file.state !== "LISTEN") return;
    const parsed = parseName(file.name);
    if (!parsed) return;
    const key = `${proc.pid}/${protocol}/${parsed.port}`;
    const v6 = parsed.host.startsWith("[") || parsed.host.includes(":");
    const existing = rows.get(key);
    const scope = scopeOf(parsed.host);
    if (existing) {
      if (!existing.addresses.includes(parsed.host)) existing.addresses.push(parsed.host);
      if (SCOPE_RANK[scope] > SCOPE_RANK[existing.scope]) existing.scope = scope;
      existing.ipv4 ||= !v6;
      existing.ipv6 ||= v6;
      return;
    }
    rows.set(key, {
      port: parsed.port,
      protocol,
      pid: proc.pid,
      command: proc.command,
      user: proc.login || proc.uid,
      addresses: [parsed.host],
      scope,
      ipv4: !v6,
      ipv6: v6,
    });
  };

  for (const line of out.split("\n")) {
    if (!line) continue;
    const tag = line[0];
    const val = line.slice(1);
    switch (tag) {
      case "p":
        flush();
        file = null;
        proc = { pid: Number(val), command: "", uid: "", login: "" };
        break;
      case "c":
        proc.command = val;
        break;
      case "u":
        proc.uid = val;
        break;
      case "L":
        proc.login = val;
        break;
      case "f":
        flush();
        file = {};
        break;
      case "P":
        if (file) file.protocol = val;
        break;
      case "n":
        if (file) file.name = val;
        break;
      case "T":
        if (file && val.startsWith("ST=")) file.state = val.slice(3);
        break;
    }
  }
  flush();
  return [...rows.values()].sort((a, b) => a.port - b.port || a.protocol.localeCompare(b.protocol) || a.pid - b.pid);
}

export type ProtoFilter = "TCP" | "UDP" | "all";

/** Digits filter by port prefix (or an exact PID); text filters by process name. */
export function filterRows(rows: PortRow[], query: string, proto: ProtoFilter): PortRow[] {
  const q = query.trim().toLowerCase();
  return rows.filter((r) => {
    if (proto !== "all" && r.protocol !== proto) return false;
    if (!q) return true;
    if (/^\d+$/.test(q)) return String(r.port).startsWith(q) || String(r.pid) === q;
    return r.command.toLowerCase().includes(q);
  });
}

export function scopeLabel(r: PortRow): string {
  const fam = r.ipv4 && r.ipv6 ? "IPv4 + IPv6" : r.ipv6 ? "IPv6" : "IPv4";
  if (r.scope === "all") return `All interfaces · ${fam}`;
  if (r.scope === "localhost") return `Localhost only · ${fam}`;
  return `${r.addresses.join(", ")}`;
}

export const COMMON_PORTS = [3000, 5173, 8080, 5432, 6379, 27017] as const;

/** Whether `pid` still holds `port` in a fresh listing (to offer Force quit). */
export function stillListening(rows: PortRow[], pid: number, port: number): boolean {
  return rows.some((r) => r.pid === pid && r.port === port);
}
