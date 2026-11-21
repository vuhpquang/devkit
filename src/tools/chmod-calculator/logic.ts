export interface Triplet {
  r: boolean;
  w: boolean;
  x: boolean;
}

export interface Perms {
  owner: Triplet;
  group: Triplet;
  others: Triplet;
  setuid: boolean;
  setgid: boolean;
  sticky: boolean;
}

export type Who = "owner" | "group" | "others";
export const WHO: Who[] = ["owner", "group", "others"];

const tripletValue = (t: Triplet) => (t.r ? 4 : 0) + (t.w ? 2 : 0) + (t.x ? 1 : 0);
const tripletFrom = (n: number): Triplet => ({ r: (n & 4) !== 0, w: (n & 2) !== 0, x: (n & 1) !== 0 });

export function specialValue(p: Perms): number {
  return (p.setuid ? 4 : 0) + (p.setgid ? 2 : 0) + (p.sticky ? 1 : 0);
}

/** "755", or "4755" when a special bit is set (or when `four` asks for it). */
export function toOctal(p: Perms, four = false): string {
  const base = WHO.map((w) => tripletValue(p[w])).join("");
  const special = specialValue(p);
  return special || four ? `${special}${base}` : base;
}

/** "rwxr-xr-x"; setuid/setgid show as s/S in the x slot, sticky as t/T. */
export function toSymbolic(p: Perms): string {
  const part = (t: Triplet, special: boolean, on: string, off: string) =>
    `${t.r ? "r" : "-"}${t.w ? "w" : "-"}${special ? (t.x ? on : off) : t.x ? "x" : "-"}`;
  return part(p.owner, p.setuid, "s", "S") + part(p.group, p.setgid, "s", "S") + part(p.others, p.sticky, "t", "T");
}

export type ParseResult = { ok: true; perms: Perms } | { ok: false; error: string };

/** Reads an octal mode (3 or 4 digits, e.g. 644 or 2775). */
export function fromOctal(input: string): ParseResult {
  const s = input.trim();
  if (!/^[0-7]{3,4}$/.test(s)) return { ok: false, error: "Use 3 or 4 octal digits (0–7), e.g. 755 or 4755" };
  const digits = s.padStart(4, "0").split("").map(Number);
  const [sp, o, g, ot] = digits;
  return {
    ok: true,
    perms: {
      owner: tripletFrom(o),
      group: tripletFrom(g),
      others: tripletFrom(ot),
      setuid: (sp & 4) !== 0,
      setgid: (sp & 2) !== 0,
      sticky: (sp & 1) !== 0,
    },
  };
}

/** Reads a symbolic mode: 9 characters like rwxr-x--x, optionally with a leading type char (-rw-r--r--, drwxr-xr-x). */
export function fromSymbolic(input: string): ParseResult {
  let s = input.trim();
  if (s.length === 10) s = s.slice(1);
  if (!/^[r-][w-][xsS-][r-][w-][xsS-][r-][w-][xtT-]$/.test(s)) {
    return { ok: false, error: "Symbolic modes look like rwxr-xr-x (s/S and t/T allowed)" };
  }
  const t = (i: number): Triplet => ({ r: s[i] === "r", w: s[i + 1] === "w", x: /[xst]/.test(s[i + 2]) });
  return {
    ok: true,
    perms: {
      owner: t(0),
      group: t(3),
      others: t(6),
      setuid: /[sS]/.test(s[2]),
      setgid: /[sS]/.test(s[5]),
      sticky: /[tT]/.test(s[8]),
    },
  };
}

/** Octal or symbolic, whichever the input looks like. */
export function parseMode(input: string): ParseResult {
  return /^\s*[0-7]+\s*$/.test(input) ? fromOctal(input) : fromSymbolic(input);
}

/** Shell-safe `chmod 755 'my file'`. */
export function chmodCommand(p: Perms, file: string): string {
  const name = file.trim() || "file";
  const quoted = /^[\w./-]+$/.test(name) ? name : `'${name.replace(/'/g, `'\\''`)}'`;
  return `chmod ${toOctal(p)} ${quoted}`;
}
