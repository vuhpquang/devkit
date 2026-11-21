export const MAX_MATCHES = 1000;

export interface RegexMatch {
  index: number;
  end: number;
  text: string;
  /** Numbered capture groups (1-based in the regex; index 0 here = group 1). */
  groups: (string | undefined)[];
  named: Record<string, string | undefined>;
}

export type MatchResult =
  | { ok: true; matches: RegexMatch[]; truncated: boolean }
  | { ok: false; error: string };

/** Builds the RegExp, or returns the engine's error message. */
export function compile(pattern: string, flags: string): { ok: true; re: RegExp } | { ok: false; error: string } {
  try {
    return { ok: true, re: new RegExp(pattern, flags) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * All matches of `pattern` in `text` (only the first without the g flag; sticky y anchors as usual).
 * Zero-length matches advance one code unit (two for a surrogate pair with u) so it never loops.
 */
export function findMatches(pattern: string, flags: string, text: string, max = MAX_MATCHES): MatchResult {
  if (!pattern) return { ok: true, matches: [], truncated: false };
  const c = compile(pattern, flags);
  if (!c.ok) return c;
  const global = flags.includes("g");
  const re = global ? c.re : new RegExp(pattern, flags.replace(/g/g, ""));
  const matches: RegexMatch[] = [];
  if (!global) {
    const m = re.exec(text);
    if (m) matches.push(toMatch(m));
    return { ok: true, matches, truncated: false };
  }
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (matches.length >= max) return { ok: true, matches, truncated: true };
    matches.push(toMatch(m));
    if (m[0] === "") {
      const cp = flags.includes("u") ? text.codePointAt(re.lastIndex) : undefined;
      re.lastIndex += cp !== undefined && cp > 0xffff ? 2 : 1;
      if (re.lastIndex > text.length) break;
    }
  }
  return { ok: true, matches, truncated: false };
}

function toMatch(m: RegExpExecArray): RegexMatch {
  return {
    index: m.index,
    end: m.index + m[0].length,
    text: m[0],
    groups: m.slice(1),
    named: { ...(m.groups ?? {}) },
  };
}

export interface Segment {
  text: string;
  /** Index into the match list, or null for text between matches. */
  match: number | null;
}

/** Splits text into plain and matched segments for highlighting. */
export function segments(text: string, matches: RegexMatch[]): Segment[] {
  const out: Segment[] = [];
  let pos = 0;
  matches.forEach((m, i) => {
    if (m.index > pos) out.push({ text: text.slice(pos, m.index), match: null });
    if (m.end > m.index) out.push({ text: text.slice(m.index, m.end), match: i });
    pos = Math.max(pos, m.end);
  });
  if (pos < text.length) out.push({ text: text.slice(pos), match: null });
  return out;
}

/** `text.replace` with the same pattern/flags; errors come back as a result. */
export function replaceAll(pattern: string, flags: string, text: string, replacement: string) {
  const c = compile(pattern, flags);
  if (!c.ok) return c;
  return { ok: true as const, value: text.replace(c.re, replacement) };
}
