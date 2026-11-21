export interface DnsPreset {
  id: string;
  name: string;
  /** Empty = Automatic (whatever the router hands out). */
  servers: string[];
  note?: string;
  custom?: boolean;
}

export const BUILT_IN: DnsPreset[] = [
  { id: "auto", name: "Automatic", servers: [], note: "From your router (DHCP)" },
  { id: "google", name: "Google", servers: ["8.8.8.8", "8.8.4.4"] },
  { id: "cloudflare", name: "Cloudflare", servers: ["1.1.1.1", "1.0.0.1"] },
  { id: "dnspod", name: "DNSPod", servers: ["119.29.29.29"], note: "Tencent" },
];

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/** IPv4 dotted quad, or an IPv6 address (validated by the URL parser). */
export function isIp(s: string): boolean {
  const v = s.trim();
  if (IPV4.test(v)) return true;
  if (!v.includes(":") || /[^0-9a-fA-F:.]/.test(v)) return false;
  try {
    return new URL(`http://[${v}]/`).hostname.length > 2;
  } catch {
    return false;
  }
}

/** "8.8.8.8, 1.1.1.1  9.9.9.9" → list; errors name the bad entry. */
export function parseServers(text: string): { ok: true; servers: string[] } | { ok: false; error: string } {
  const parts = text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return { ok: false, error: "Enter at least one DNS server address." };
  if (parts.length > 6) return { ok: false, error: "Use at most 6 servers." };
  const bad = parts.find((p) => !isIp(p));
  if (bad) return { ok: false, error: `“${bad}” isn't an IP address.` };
  return { ok: true, servers: [...new Set(parts)] };
}

/** Name servers of the first resolver in `scutil --dns` — the ones the Mac actually asks. */
export function activeResolvers(scutil: string): string[] {
  const first = scutil.split(/\n(?=resolver #)/).find((block) => /resolver #1\b/.test(block)) ?? "";
  const out: string[] = [];
  for (const m of first.matchAll(/nameserver\[\d+\]\s*:\s*(\S+)/g)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** The preset whose servers equal `servers` (order doesn't matter); Automatic when there are none. */
export function matchPreset(servers: string[], presets: DnsPreset[]): DnsPreset | undefined {
  return presets.find((p) => sameSet(p.servers, servers));
}

/* ------------------------------------------------------ custom presets */

const KEY = "devkit.dns.presets";

export function loadCustom(): DnsPreset[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(v)) return [];
    return v
      .filter(
        (p): p is DnsPreset =>
          !!p && typeof p.id === "string" && typeof p.name === "string" && Array.isArray(p.servers) && p.servers.every((s: unknown) => typeof s === "string" && isIp(s)),
      )
      .map((p) => ({ id: p.id, name: p.name, servers: p.servers, custom: true }));
  } catch {
    return [];
  }
}

export function saveCustom(list: DnsPreset[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.map(({ id, name, servers }) => ({ id, name, servers }))));
  } catch {
    /* storage blocked: list still works this session */
  }
}

export function newCustom(name: string, serversText: string, existing: DnsPreset[]): { ok: true; preset: DnsPreset } | { ok: false; error: string } {
  const n = name.trim();
  if (!n) return { ok: false, error: "Give the preset a name." };
  if (n.length > 40) return { ok: false, error: "Keep the name under 40 characters." };
  if ([...BUILT_IN, ...existing].some((p) => p.name.toLowerCase() === n.toLowerCase())) {
    return { ok: false, error: `There is already a preset called “${n}”.` };
  }
  const parsed = parseServers(serversText);
  if (!parsed.ok) return parsed;
  return { ok: true, preset: { id: `custom-${Date.now().toString(36)}`, name: n, servers: parsed.servers, custom: true } };
}
