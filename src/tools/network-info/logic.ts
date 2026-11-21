import type { NetInfoRaw } from "../../lib/system";

export interface Iface {
  name: string;
  /** Friendly port name from `networksetup -listallhardwareports` (Wi-Fi, Thunderbolt Ethernet…). */
  port?: string;
  active: boolean;
  up: boolean;
  /** Loopback, VPN tunnels, AirDrop/Wi-Fi Direct, bridges, Apple's internal anpi/ap/gif/stf/llw… */
  virtual: boolean;
  mtu?: number;
  mac?: string;
  ipv4: { address: string; cidr: number; broadcast?: string }[];
  ipv6: { address: string; prefix: number; linkLocal: boolean; temporary: boolean }[];
}

const VIRTUAL = /^(lo|utun|awdl|llw|bridge|gif|stf|anpi|ap|ipsec|ppp|vmenet|vnic|feth|pktap)\d*/;

/** 0xffffff00 → 24; 255.255.255.0 → 24. */
export function maskToCidr(mask: string): number {
  let n: number;
  if (/^0x[0-9a-f]+$/i.test(mask)) n = parseInt(mask, 16);
  else {
    const parts = mask.split(".").map(Number);
    if (parts.length !== 4 || parts.some((p) => !(p >= 0 && p <= 255))) return 0;
    n = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  }
  let bits = 0;
  for (let i = 31; i >= 0; i--) {
    if (n & (2 ** i)) bits++;
    else break;
  }
  return bits;
}

/** device → friendly port name. */
export function parseHardwarePorts(out: string): Map<string, string> {
  const map = new Map<string, string>();
  let port: string | null = null;
  for (const raw of out.split("\n")) {
    const line = raw.trim();
    const p = /^Hardware Port:\s*(.+)$/.exec(line);
    if (p) {
      port = p[1];
      continue;
    }
    const d = /^Device:\s*(\S+)$/.exec(line);
    if (d && port) {
      map.set(d[1], port);
      port = null;
    }
  }
  return map;
}

export function parseIfconfig(out: string, ports: Map<string, string> = new Map()): Iface[] {
  const list: Iface[] = [];
  let cur: Iface | null = null;
  for (const line of out.split("\n")) {
    const head = /^([a-zA-Z0-9]+): flags=\w+<([^>]*)>(?:.*?mtu (\d+))?/.exec(line);
    if (head) {
      const flags = head[2].split(",");
      cur = {
        name: head[1],
        port: ports.get(head[1]),
        up: flags.includes("UP"),
        // Loopback has no "status:" line; it's active whenever it's up.
        active: flags.includes("LOOPBACK") && flags.includes("UP"),
        virtual: VIRTUAL.test(head[1]),
        mtu: head[3] ? Number(head[3]) : undefined,
        ipv4: [],
        ipv6: [],
      };
      list.push(cur);
      continue;
    }
    if (!cur) continue;
    const t = line.trim();
    let m: RegExpExecArray | null;
    if ((m = /^ether ([0-9a-f:]{17})/i.exec(t))) cur.mac = m[1];
    else if ((m = /^inet (\S+) netmask (\S+)(?: broadcast (\S+))?/.exec(t)))
      cur.ipv4.push({ address: m[1], cidr: maskToCidr(m[2]), broadcast: m[3] });
    else if ((m = /^inet6 (\S+) prefixlen (\d+)(.*)$/.exec(t))) {
      const address = m[1].replace(/%.*$/, "");
      cur.ipv6.push({
        address,
        prefix: Number(m[2]),
        linkLocal: /^fe80:/i.test(address),
        temporary: /\btemporary\b/.test(m[3]),
      });
    } else if ((m = /^status: (\w+)/.exec(t))) cur.active = m[1] === "active";
  }
  return list;
}

export function parseDefaultRoute(out: string): { gateway?: string; iface?: string } {
  const gw = /^\s*gateway:\s*(\S+)/m.exec(out)?.[1];
  const iface = /^\s*interface:\s*(\S+)/m.exec(out)?.[1];
  return { gateway: gw, iface };
}

/** Nameservers from `scutil --dns`, resolver #1 first, unique, mDNS-only resolvers skipped. */
export function parseScutilDns(out: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  // Only the first section ("DNS configuration"); the scoped section repeats the same servers.
  const main = out.split(/\nDNS configuration \(for scoped queries\)/)[0];
  for (const m of main.matchAll(/nameserver\[\d+\]\s*:\s*(\S+)/g)) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      result.push(m[1]);
    }
  }
  return result;
}

export type Ssid = { kind: "name"; value: string } | { kind: "hidden" } | { kind: "none" };

/** SSID from `ipconfig getsummary`; macOS redacts it without Location permission. */
export function parseSsid(summary: string): Ssid {
  const m = /^\s*SSID\s*:\s*(.+)$/m.exec(summary);
  if (!m) return { kind: "none" };
  const v = m[1].trim();
  return v === "<redacted>" ? { kind: "hidden" } : { kind: "name", value: v };
}

export interface NetSummary {
  hostname: string;
  interfaces: Iface[];
  primary?: Iface;
  gateway?: string;
  dns: string[];
  ssid: Ssid;
}

export function summarize(raw: NetInfoRaw): NetSummary {
  const ports = parseHardwarePorts(raw.hardware_ports);
  const interfaces = parseIfconfig(raw.ifconfig, ports);
  const route = parseDefaultRoute(raw.route);
  const primary =
    interfaces.find((i) => i.name === route.iface) ?? interfaces.find((i) => i.active && !i.virtual && i.ipv4.length > 0);
  return {
    hostname: raw.hostname,
    interfaces,
    primary,
    gateway: route.gateway,
    dns: parseScutilDns(raw.scutil_dns),
    ssid: parseSsid(raw.wifi_summary),
  };
}

/** Interfaces worth a panel: active ones with an address, virtual ones only when asked. */
export function visibleInterfaces(list: Iface[], showVirtual: boolean): Iface[] {
  return list.filter((i) => i.active && (i.ipv4.length > 0 || i.ipv6.length > 0) && (showVirtual || !i.virtual));
}
