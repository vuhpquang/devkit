import { fetch } from "@tauri-apps/plugin-http";

export const REPO = "vuhpquang/devkit";
const API = `https://api.github.com/repos/${REPO}`;

/** -1 / 0 / 1 comparing dotted numeric versions; a leading "v" is ignored. */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

export interface Release {
  version: string;
  notes: string;
  url: string;
}

interface GhRelease {
  tag_name?: unknown;
  body?: unknown;
  html_url?: unknown;
}

/** Validates GitHub's release JSON. */
export function toRelease(j: unknown): Release {
  const r = (j ?? {}) as GhRelease;
  if (typeof r.tag_name !== "string") throw new Error("GitHub sent a release without a tag");
  return {
    version: r.tag_name.replace(/^v/, ""),
    notes: typeof r.body === "string" ? r.body : "",
    url: typeof r.html_url === "string" ? r.html_url : `https://github.com/${REPO}/releases`,
  };
}

async function getJson(url: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: "application/vnd.github+json", "User-Agent": "DevKit" } });
  } catch {
    throw new Error("Couldn't reach GitHub. Check your connection and try again.");
  }
  if (res.status === 404) throw new Error("No release found on GitHub.");
  if (res.status === 403 || res.status === 429) throw new Error("GitHub is rate-limiting requests. Try again in a few minutes.");
  if (!res.ok) throw new Error(`GitHub answered ${res.status}. Try again later.`);
  return res.json();
}

export const fetchLatestRelease = async () => toRelease(await getJson(`${API}/releases/latest`));
export const fetchRelease = async (version: string) => toRelease(await getJson(`${API}/releases/tags/v${version}`));

/* ------------------------------------------------------------- Notes */

export type NoteBlock = { kind: "heading" | "bullet" | "paragraph"; text: string };

/** GitHub release notes (Markdown) → headings, bullets and paragraphs, like app-shell's ReleaseNotes. */
export function noteBlocks(markdown: string): NoteBlock[] {
  const out: NoteBlock[] = [];
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) out.push({ kind: "heading", text: line.replace(/^#+\s*/, "") });
    else if (/^[-*+]\s/.test(line)) out.push({ kind: "bullet", text: line.slice(2) });
    else out.push({ kind: "paragraph", text: line });
  }
  return out;
}

/* --------------------------------------------------------- What's New */

const SEEN_KEY = "devkit.whatsNew.lastVersion";

/**
 * Whether to open What's New for the running version. The first run records the version silently
 * (nothing to show a new user); afterwards it opens once each time the version goes up.
 */
export function shouldShowWhatsNew(lastSeen: string | null, current: string): boolean {
  return lastSeen !== null && compareVersions(current, lastSeen) > 0;
}

/** Reads and records the last version seen; returns whether What's New should open. */
export function checkWhatsNew(current: string): boolean {
  let last: string | null = null;
  try {
    last = localStorage.getItem(SEEN_KEY);
    localStorage.setItem(SEEN_KEY, current);
  } catch {
    return false;
  }
  return shouldShowWhatsNew(last, current);
}
