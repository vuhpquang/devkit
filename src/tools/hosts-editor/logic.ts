import { isIp } from "../dns-switcher/logic";

export interface HostsLine {
  /** 0-based line number in the file. */
  index: number;
  kind: "entry" | "comment" | "blank" | "invalid";
  /** Entries only: false when the line is commented out (`# 127.0.0.1 x.test`). */
  enabled: boolean;
  ip: string;
  names: string[];
  /** Trailing `# comment` on an entry line. */
  note: string;
  /** localhost / broadcasthost lines macOS needs. */
  system: boolean;
  raw: string;
}

const HOST = /^[A-Za-z0-9_]([A-Za-z0-9_.-]{0,252})$/;
export const isHostName = (s: string) => HOST.test(s) && !s.includes("..");

const SYSTEM_NAMES = new Set(["localhost", "broadcasthost"]);

function parseEntry(body: string): { ip: string; names: string[]; note: string } | null {
  const [main, ...rest] = body.split("#");
  const parts = main.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2 || !isIp(parts[0]) || !parts.slice(1).every(isHostName)) return null;
  return { ip: parts[0], names: parts.slice(1), note: rest.join("#").trim() };
}

export function parseHosts(text: string): HostsLine[] {
  return text.split("\n").map((raw, index) => {
    const base = { index, raw, enabled: true, ip: "", names: [] as string[], note: "", system: false };
    const t = raw.trim();
    if (!t) return { ...base, kind: "blank" as const };
    if (t.startsWith("#")) {
      // A commented-out entry ("#127.0.0.1 a.test") is a disabled entry; anything else is a plain comment.
      const e = parseEntry(t.replace(/^#+\s?/, ""));
      return e ? { ...base, ...e, kind: "entry" as const, enabled: false } : { ...base, kind: "comment" as const };
    }
    const e = parseEntry(t);
    if (!e) return { ...base, kind: "invalid" as const };
    return { ...base, ...e, kind: "entry" as const, system: e.names.some((n) => SYSTEM_NAMES.has(n)) };
  });
}

const lines = (text: string) => text.split("\n");

/** Comments an entry out, or back in. System entries are left alone. */
export function toggleEntry(text: string, index: number): string {
  const parsed = parseHosts(text)[index];
  if (!parsed || parsed.kind !== "entry" || parsed.system) return text;
  const ls = lines(text);
  ls[index] = parsed.enabled ? `# ${ls[index]}` : ls[index].replace(/^(\s*)#+\s?/, "$1");
  return ls.join("\n");
}

export function removeLine(text: string, index: number): string {
  const parsed = parseHosts(text)[index];
  if (!parsed || parsed.system) return text;
  const ls = lines(text);
  ls.splice(index, 1);
  return ls.join("\n");
}

/** Appends `ip names…`; errors say what to fix. */
export function addEntry(text: string, ip: string, namesText: string): { ok: true; text: string } | { ok: false; error: string } {
  const addr = ip.trim();
  if (!isIp(addr)) return { ok: false, error: `“${addr || "(empty)"}” isn't an IP address.` };
  const names = namesText.split(/[\s,]+/).filter(Boolean);
  if (!names.length) return { ok: false, error: "Add at least one host name." };
  const bad = names.find((n) => !isHostName(n));
  if (bad) return { ok: false, error: `“${bad}” isn't a valid host name.` };
  const body = text.replace(/\n*$/, "");
  return { ok: true, text: `${body}\n${addr}\t${names.join(" ")}\n` };
}

/** Lines that don't look like an entry or a comment — shown as a warning before saving. */
export const invalidLines = (text: string) => parseHosts(text).filter((l) => l.kind === "invalid");
