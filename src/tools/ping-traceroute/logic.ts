/** Parsing of macOS ping / ping6 / traceroute / traceroute6 output, and the stats shown live. */

export type PingLine =
  | { kind: "reply"; seq: number; from: string; ttl: number | null; ms: number }
  | { kind: "timeout"; seq: number }
  | { kind: "error"; message: string }
  | { kind: "summary"; transmitted: number; received: number; lossPct: number }
  | { kind: "rtt"; min: number; avg: number; max: number; stddev: number }
  | { kind: "other" };

const REPLY = /^\d+ bytes from (\S+?)[:,]?\s+(?:icmp_seq|icmp6_seq|seq)=(\d+)(?:\s+(?:ttl|hlim)=(\d+))?\s+time=([\d.]+) ms/;

export function parsePingLine(raw: string): PingLine {
  const line = raw.trim();
  let m = REPLY.exec(line);
  if (m) {
    return { kind: "reply", from: m[1], seq: Number(m[2]), ttl: m[3] ? Number(m[3]) : null, ms: Number(m[4]) };
  }
  m = /^Request timeout for icmp_seq (\d+)/.exec(line);
  if (m) return { kind: "timeout", seq: Number(m[1]) };
  m = /^(\d+) packets transmitted, (\d+) (?:packets )?received,(?: \+\d+ duplicates,)? ([\d.]+)% packet loss/.exec(line);
  if (m) return { kind: "summary", transmitted: Number(m[1]), received: Number(m[2]), lossPct: Number(m[3]) };
  m = /^round-trip min\/avg\/max\/(?:stddev|std-dev) = ([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+) ms/.exec(line);
  if (m) return { kind: "rtt", min: Number(m[1]), avg: Number(m[2]), max: Number(m[3]), stddev: Number(m[4]) };
  if (/^ping6?: /.test(line)) return { kind: "error", message: line.replace(/^ping6?: /, "") };
  return { kind: "other" };
}

/** One sample per sequence number: a time in ms, or null for a timeout. */
export interface Sample {
  seq: number;
  ms: number | null;
}

export interface PingStats {
  sent: number;
  received: number;
  lossPct: number;
  min: number | null;
  avg: number | null;
  max: number | null;
  /** Mean absolute difference between consecutive replies (RFC 3550 style, without smoothing). */
  jitter: number | null;
}

export function pingStats(samples: Sample[]): PingStats {
  const times = samples.filter((s) => s.ms !== null).map((s) => s.ms as number);
  const sent = samples.length;
  const received = times.length;
  let jitter: number | null = null;
  if (times.length >= 2) {
    let sum = 0;
    for (let i = 1; i < times.length; i++) sum += Math.abs(times[i] - times[i - 1]);
    jitter = sum / (times.length - 1);
  }
  return {
    sent,
    received,
    lossPct: sent ? ((sent - received) / sent) * 100 : 0,
    min: received ? Math.min(...times) : null,
    avg: received ? times.reduce((a, b) => a + b, 0) / received : null,
    max: received ? Math.max(...times) : null,
    jitter,
  };
}

/** Adds a reply/timeout to the sample list (a late reply replaces its timeout), keeping the last `cap`. */
export function addSample(samples: Sample[], line: PingLine, cap = 2000): Sample[] {
  if (line.kind !== "reply" && line.kind !== "timeout") return samples;
  const ms = line.kind === "reply" ? line.ms : null;
  const i = samples.findIndex((s) => s.seq === line.seq);
  const next = i >= 0 ? samples.map((s, j) => (j === i ? { seq: s.seq, ms: ms ?? s.ms } : s)) : [...samples, { seq: line.seq, ms }];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/* --------------------------------------------------------------- Traceroute */

export interface Hop {
  hop: number;
  address: string | null;
  /** Round-trip times of the probes that answered. */
  times: number[];
}

export type TraceLine =
  | { kind: "header"; target: string; address: string | null; maxHops: number | null }
  | { kind: "hop"; hop: Hop }
  | { kind: "error"; message: string }
  | { kind: "other" };

const ADDR = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[0-9a-fA-F:]*:[0-9a-fA-F:.]+)$/;

export function parseTraceLine(raw: string): TraceLine {
  const line = raw.replace(/\s+$/, "");
  let m = /^traceroute6? to (\S+)(?: \(([^)]+)\))?(?: from \S+)?,? (\d+) hops max/.exec(line.trim());
  if (m) return { kind: "header", target: m[1], address: m[2] ?? null, maxHops: Number(m[3]) };
  m = /^\s*(\d+)\s+(.*)$/.exec(line);
  if (m) {
    const tokens = m[2].trim().split(/\s+/);
    let address: string | null = null;
    const times: number[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t === "*") continue;
      if (tokens[i + 1] === "ms" && /^[\d.]+$/.test(t)) {
        times.push(Number(t));
        i++;
      } else if (address === null && ADDR.test(t)) {
        address = t;
      } else if (address === null && /^\(.+\)$/.test(t) && ADDR.test(t.slice(1, -1))) {
        address = t.slice(1, -1);
      }
    }
    if (address === null && times.length === 0 && !tokens.every((t) => t === "*")) return { kind: "other" };
    return { kind: "hop", hop: { hop: Number(m[1]), address, times } };
  }
  if (/^traceroute6?: /.test(line.trim())) return { kind: "error", message: line.trim().replace(/^traceroute6?: /, "") };
  return { kind: "other" };
}

/** Best time of a hop, or null when nothing answered. */
export const hopTime = (h: Hop): number | null => (h.times.length ? Math.min(...h.times) : null);

/** Keeps the last `cap` lines. */
export function capLines(lines: string[], add: string, cap = 2000): string[] {
  const next = [...lines, add];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** Hosts the Rust side accepts: letters, digits, dots, dashes, colons, underscores; no leading dash. */
export function validHost(host: string): boolean {
  const h = host.trim();
  return h.length > 0 && h.length <= 253 && !h.startsWith("-") && /^[A-Za-z0-9.\-:_]+$/.test(h);
}
