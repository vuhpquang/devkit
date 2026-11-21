/* Pure logic for the GitLab tool: request URLs, paging, formatting, grouping, filtering, sorting. */

/* ------------------------------------------------------------- Settings */

export type Tab = "pipelines" | "mrs";
export type ScanMode = "fast" | "full";
export type Role = "all" | "author" | "assignee" | "reviewer";
export type MrStateFilter = "all" | "opened" | "merged" | "closed" | "conflict";
export type SortDir = 1 | -1;

export interface GitLabSettings {
  base: string;
  token: string;
  user: string;
  group: string;
  days: number;
  /** Auto refresh in seconds; 0 = off. */
  auto: number;
  tab: Tab;
  collapsed: boolean;
  pipelines: { mode: ScanMode; q: string; status: string | null; sortKey: string; sortDir: SortDir };
  mrs: { role: Role; mstate: MrStateFilter; q: string; state: string | null; sortKey: string; sortDir: SortDir };
}

export const DEFAULT_SETTINGS: GitLabSettings = {
  base: "",
  token: "",
  user: "",
  group: "",
  days: 30,
  auto: 0,
  tab: "pipelines",
  collapsed: false,
  pipelines: { mode: "fast", q: "", status: null, sortKey: "created_at", sortDir: -1 },
  mrs: { role: "all", mstate: "all", q: "", state: null, sortKey: "updated_at", sortDir: -1 },
};

export const AUTO_REFRESH = [0, 60, 180, 300] as const;

/** Reads stored settings; anything missing or of the wrong type falls back to the default. */
export function parseSettings(raw: string | null): GitLabSettings {
  let v: Record<string, unknown> = {};
  try {
    const p: unknown = JSON.parse(raw ?? "{}");
    if (p && typeof p === "object" && !Array.isArray(p)) v = p as Record<string, unknown>;
  } catch {
    /* corrupt → defaults */
  }
  const d = DEFAULT_SETTINGS;
  const str = (x: unknown, def: string) => (typeof x === "string" ? x : def);
  const oneOf = <T extends string>(x: unknown, list: readonly T[], def: T): T =>
    typeof x === "string" && (list as readonly string[]).includes(x) ? (x as T) : def;
  const obj = (x: unknown): Record<string, unknown> => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {});
  const dir = (x: unknown, def: SortDir): SortDir => (x === 1 || x === -1 ? x : def);
  const nullableStr = (x: unknown) => (typeof x === "string" ? x : null);
  const days = typeof v.days === "number" && v.days >= 1 && v.days <= 365 ? Math.floor(v.days) : d.days;
  const auto = typeof v.auto === "number" && (AUTO_REFRESH as readonly number[]).includes(v.auto) ? v.auto : d.auto;
  const p = obj(v.pipelines);
  const m = obj(v.mrs);
  return {
    base: str(v.base, d.base),
    token: str(v.token, d.token),
    user: str(v.user, d.user),
    group: str(v.group, d.group),
    days,
    auto,
    tab: oneOf(v.tab, ["pipelines", "mrs"], d.tab),
    collapsed: typeof v.collapsed === "boolean" ? v.collapsed : d.collapsed,
    pipelines: {
      mode: oneOf(p.mode, ["fast", "full"], d.pipelines.mode),
      q: str(p.q, ""),
      status: nullableStr(p.status),
      sortKey: str(p.sortKey, d.pipelines.sortKey),
      sortDir: dir(p.sortDir, d.pipelines.sortDir),
    },
    mrs: {
      role: oneOf(m.role, ["all", "author", "assignee", "reviewer"], d.mrs.role),
      mstate: oneOf(m.mstate, ["all", "opened", "merged", "closed", "conflict"], d.mrs.mstate),
      q: str(m.q, ""),
      state: nullableStr(m.state),
      sortKey: str(m.sortKey, d.mrs.sortKey),
      sortDir: dir(m.sortDir, d.mrs.sortDir),
    },
  };
}

/** Enough to talk to GitLab: a valid http(s) URL, a token and a username. */
export function isConfigured(s: Pick<GitLabSettings, "base" | "token" | "user">): boolean {
  return !!(s.token.trim() && s.user.trim() && normalizeBase(s.base));
}

/**
 * "https://gitlab.example.com///" → "https://gitlab.example.com". null when it isn't https — plain http only
 * for this machine (localhost), so the token never crosses a network in clear text.
 */
export function normalizeBase(base: string): string | null {
  const b = base.trim().replace(/\/+$/, "");
  if (!b) return null;
  try {
    const u = new URL(b);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
    if (u.protocol !== "https:" && !(u.protocol === "http:" && loopback)) return null;
    return b;
  } catch {
    return null;
  }
}

/* --------------------------------------------------------------- Requests */

/**
 * Builds a GitLab REST URL. The token is NOT part of it: it goes in the `PRIVATE-TOKEN` header, so it never
 * lands in GitLab's or a proxy's access log. One-segment paths get their trailing slash up front, because
 * some reverse proxies redirect `/projects` → `/projects/`.
 */
export function apiUrl(base: string, path: string, params: Record<string, string | number | boolean> = {}): string {
  const b = normalizeBase(base);
  if (!b) throw new Error("Enter your GitLab URL, e.g. https://gitlab.example.com (https only)");
  const p = /^\/[^/]+$/.test(path) ? path + "/" : path;
  const url = new URL(b + "/api/v4" + p);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  return url.toString();
}

export type Fetcher = (
  url: string,
  init: { method: string; headers: Record<string, string> },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export class GitLabError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

/** Human message for a failed call, saying what to check. */
export function describeError(status: number | undefined, path: string): string {
  if (status === undefined) return "Couldn't reach GitLab. Check the GitLab URL, your network or VPN.";
  if (status === 401) return "GitLab rejected the token (401). Check the token and that it hasn't expired.";
  if (status === 403) return `No permission for ${path} (403). The token needs read_api (api to retry or cancel).`;
  if (status === 404) return `Not found: ${path} (404). Check the GitLab URL, username and group.`;
  if (status === 429) return "GitLab is rate-limiting requests (429). Try again in a minute.";
  return `GitLab answered ${status} for ${path}. Check the GitLab URL and token.`;
}

export interface Client {
  api: <T = unknown>(path: string, params?: Record<string, string | number | boolean>, method?: "GET" | "POST") => Promise<T>;
  paged: <T = unknown>(path: string, params?: Record<string, string | number | boolean>, maxPages?: number) => Promise<T[]>;
}

export function createClient(cfg: { base: string; token: string }, fetcher: Fetcher): Client {
  const api = async <T,>(path: string, params: Record<string, string | number | boolean> = {}, method: "GET" | "POST" = "GET"): Promise<T> => {
    const url = apiUrl(cfg.base, path, params);
    let res;
    try {
      res = await fetcher(url, { method, headers: { "PRIVATE-TOKEN": cfg.token.trim() } });
    } catch {
      throw new GitLabError(describeError(undefined, path));
    }
    if (!res.ok) throw new GitLabError(describeError(res.status, path), res.status);
    return (await res.json()) as T;
  };
  const paged = async <T,>(path: string, params: Record<string, string | number | boolean> = {}, maxPages = 20): Promise<T[]> => {
    const out: T[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const data = await api<T[]>(path, { ...params, per_page: 100, page });
      out.push(...data);
      if (data.length < 100) break;
    }
    return out;
  };
  return { api, paged };
}

/** Runs `fn` over `items` with at most `n` calls in flight. */
export async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const it = items[i++];
        await fn(it);
      }
    }),
  );
}

/** ISO timestamp `days` days ago. */
export function sinceIso(days: number, now = Date.now()): string {
  return new Date(now - (days || 30) * 864e5).toISOString();
}

/* ------------------------------------------------------------- Formatting */

/** 42 → "42s", 125 → "2m 5s", 3 700 → "1h 1m", 90 000 → "1d 1h". Empty for null. */
export function fmtDur(s: number | null | undefined): string {
  if (s == null || !Number.isFinite(s)) return "";
  const t = Math.max(0, Math.round(s));
  const d = Math.floor(t / 86400);
  const h = Math.floor((t % 86400) / 3600);
  const m = Math.floor((t % 3600) / 60);
  const x = t % 60;
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : m ? `${m}m ${x}s` : `${x}s`;
}

/** "group/sub/project" → ["group/sub/", "project"]. */
export function splitProject(path: string): [string, string] {
  const i = path.lastIndexOf("/");
  return [path.slice(0, i + 1), path.slice(i + 1)];
}

/** Project web URL from any URL inside it: ".../group/proj/-/pipelines/1" → ".../group/proj". */
export function projectUrl(webUrl: string): string {
  return webUrl.split("/-/")[0];
}

/** MR pipelines (refs/merge-requests/123/head) link to the MR; other refs to their tree. */
export function refUrl(project: string, ref: string | null | undefined): string {
  const mr = /^refs\/merge-requests\/(\d+)\//.exec(ref || "");
  return mr
    ? `${project}/-/merge_requests/${mr[1]}`
    : `${project}/-/tree/${(ref || "").split("/").map(encodeURIComponent).join("/")}`;
}

export type Tone = "neutral" | "accent" | "info" | "success" | "danger";

/** Badge colour for a pipeline or MR status. */
export function statusTone(status: string | null | undefined): Tone {
  switch (status) {
    case "success":
    case "merged":
      return "success";
    case "failed":
    case "closed":
      return "danger";
    case "running":
    case "opened":
      return "info";
    case "pending":
    case "created":
    case "waiting_for_resource":
    case "preparing":
    case "scheduled":
      return "accent";
    default:
      return "neutral";
  }
}

/* ------------------------------------------------------------- Pipelines */

export const TERMINAL = new Set(["success", "failed", "canceled", "skipped"]);
export const RETRYABLE = new Set(["failed", "canceled"]);
export const CANCELABLE = new Set(["running", "pending", "created", "waiting_for_resource", "preparing", "scheduled"]);

export interface PipelineRow {
  id: number;
  project_id: number;
  project: string;
  status: string;
  ref: string;
  sha: string;
  web_url: string;
  created_at: string;
  updated_at?: string;
  started_at?: string | null;
  finished_at?: string | null;
  duration?: number | null;
  commit?: string;
}

/** Seconds the pipeline took; a running one counts up from its start. */
export function pipelineDuration(r: PipelineRow, now = Date.now()): number | null {
  if (r.duration != null) return r.duration;
  if (r.status === "running" && r.started_at) return (now - Date.parse(r.started_at)) / 1000;
  return null;
}

/** When it finished; a finished pipeline without finished_at (e.g. cancelled before it ran) uses updated_at. */
export function pipelineEnd(r: PipelineRow): string | null {
  return r.finished_at || (TERMINAL.has(r.status) ? r.updated_at : null) || null;
}

/* ------------------------------------------------------- Merge requests */

export interface MrRow {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  state: string;
  draft: boolean;
  web_url: string;
  project: string;
  source_branch: string;
  target_branch: string;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  closed_at: string | null;
  author: string;
  reviewers: string[];
  merge_status: string;
  user_notes_count: number;
  has_conflicts: boolean;
  pipeline?: { status: string; web_url: string } | null;
}

interface ApiMr {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  state: string;
  draft?: boolean;
  work_in_progress?: boolean;
  web_url: string;
  references?: { full?: string };
  source_branch: string;
  target_branch: string;
  created_at: string;
  updated_at: string;
  merged_at?: string | null;
  closed_at?: string | null;
  author?: { username?: string };
  reviewers?: { username: string }[];
  detailed_merge_status?: string;
  merge_status?: string;
  user_notes_count?: number;
  has_conflicts?: boolean;
}

export function toMrRow(m: ApiMr): MrRow {
  return {
    id: m.id,
    iid: m.iid,
    project_id: m.project_id,
    title: m.title,
    state: m.state,
    draft: !!(m.draft || m.work_in_progress),
    web_url: m.web_url,
    project: (m.references?.full || "").replace(/!\d+$/, ""),
    source_branch: m.source_branch,
    target_branch: m.target_branch,
    created_at: m.created_at,
    updated_at: m.updated_at,
    merged_at: m.merged_at ?? null,
    closed_at: m.closed_at ?? null,
    author: m.author?.username ?? "",
    reviewers: (m.reviewers || []).map((u) => u.username),
    merge_status: m.detailed_merge_status || m.merge_status || "",
    user_notes_count: m.user_notes_count ?? 0,
    has_conflicts: !!m.has_conflicts,
  };
}

/**
 * The API has no OR between roles, so "All roles" asks three times; this merges the lists by id, keeps
 * only conflicting MRs for the Conflict filter (the API can't filter on it), newest update first.
 */
export function mergeMrLists(lists: ApiMr[][], mstate: MrStateFilter): MrRow[] {
  const byId = new Map<number, ApiMr>();
  for (const m of lists.flat()) byId.set(m.id, m);
  return [...byId.values()]
    .filter((m) => mstate !== "conflict" || m.has_conflicts)
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0))
    .map(toMrRow);
}

/** Query for the MR list: state (Conflict = opened + client filter) and one role's username. */
export function mrQuery(mstate: MrStateFilter, since: string): Record<string, string> {
  const q: Record<string, string> = { scope: "all", updated_after: since, order_by: "updated_at", sort: "desc" };
  if (mstate !== "all") q.state = mstate === "conflict" ? "opened" : mstate;
  return q;
}

export function rolesFor(role: Role): Exclude<Role, "all">[] {
  return role === "all" ? ["author", "assignee", "reviewer"] : [role];
}

/** merged: created → merged · closed: created → closed · open: age so far. */
export function mrDuration(r: MrRow, now = Date.now()): number | null {
  const end = r.merged_at || r.closed_at || (r.state === "opened" ? now : null);
  return end ? ((typeof end === "number" ? end : Date.parse(end)) - Date.parse(r.created_at)) / 1000 : null;
}

/** Who to show: for your own MRs the reviewers, for other people's the author. */
export function mrWho(r: MrRow, role: Role, user: string): string {
  return role === "author" || (role === "all" && r.author === user) ? r.reviewers.join(", ") : r.author;
}

export function mrWhoLabel(role: Role): string {
  return role === "author" ? "Reviewers" : role === "all" ? "People" : "Author";
}

export interface MrSummary {
  projects: number;
  avgToMerge: number | null;
  drafts: number;
  conflicts: number;
}

export function mrSummary(rows: MrRow[]): MrSummary {
  const merged = rows.filter((r) => r.state === "merged");
  const durations = merged.map((r) => mrDuration(r)).filter((d): d is number => d != null);
  return {
    projects: new Set(rows.map((r) => r.project)).size,
    avgToMerge: durations.length ? durations.reduce((s, d) => s + d, 0) / durations.length : null,
    drafts: rows.filter((r) => r.state === "opened" && r.draft).length,
    conflicts: rows.filter((r) => r.state === "opened" && r.has_conflicts).length,
  };
}

/* ------------------------------------------------- Counting, filter, sort */

/** [status, count] pairs, most frequent first. */
export function countBy<T>(rows: T[], key: (r: T) => string): [string, number][] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(key(r), (counts.get(key(r)) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/** Rows matching the status chip (if any) and every character of the search text in `haystack`. */
export function filterRows<T>(rows: T[], opts: { status: string | null; statusOf: (r: T) => string; q: string; haystack: (r: T) => string }): T[] {
  const q = opts.q.trim().toLowerCase();
  return rows.filter((r) => (!opts.status || opts.statusOf(r) === opts.status) && (!q || opts.haystack(r).toLowerCase().includes(q)));
}

/**
 * Sorts by a column value. Missing values sort as "" — except durations ("_dur"), which sort as -1 so a
 * pipeline without a duration lands below every timed one in a descending sort, like the original.
 */
export function sortRows<T>(rows: T[], value: (r: T) => unknown, key: string, dir: SortDir): T[] {
  const val = (r: T) => {
    const v = value(r);
    return v ?? (key === "_dur" ? -1 : "");
  };
  return [...rows].sort((a, b) => {
    const x = val(a) as string | number;
    const y = val(b) as string | number;
    return (x > y ? 1 : x < y ? -1 : 0) * dir;
  });
}

/** Clicking a column: same column flips the direction, a new column starts descending. */
export function nextSort(current: { sortKey: string; sortDir: SortDir }, key: string): { sortKey: string; sortDir: SortDir } {
  return { sortKey: key, sortDir: current.sortKey === key ? (-current.sortDir as SortDir) : -1 };
}

/* ------------------------------------------------------------------ Cache */

export interface Cache {
  /** "projectId:sha" → commit title */
  commits: Record<string, string>;
  /** "projectId:pipelineId" → timing of a finished pipeline (it can't change any more) */
  pipes: Record<string, { duration?: number | null; started_at?: string | null; finished_at?: string | null }>;
  /** Projects where the user has had pipelines: always scanned in fast mode. */
  known: number[];
  uid?: { name: string; id: number };
  pipelineRows?: { at: number; rows: PipelineRow[] };
  mrRows?: { at: number; rows: MrRow[] };
}

export const EMPTY_CACHE: Cache = { commits: {}, pipes: {}, known: [] };
export const CACHE_MAX = 3000;

export function parseCache(raw: string | null): Cache {
  try {
    const v = JSON.parse(raw ?? "null") as Partial<Cache> | null;
    if (!v || typeof v !== "object") return { ...EMPTY_CACHE, commits: {}, pipes: {}, known: [] };
    return {
      commits: v.commits && typeof v.commits === "object" ? v.commits : {},
      pipes: v.pipes && typeof v.pipes === "object" ? v.pipes : {},
      known: Array.isArray(v.known) ? v.known.filter((x) => typeof x === "number") : [],
      uid: v.uid,
      pipelineRows: v.pipelineRows,
      mrRows: v.mrRows,
    };
  } catch {
    return { commits: {}, pipes: {}, known: [] };
  }
}

/** Keeps only the newest `max` entries of a map (insertion order = age). */
export function trimMap<V>(m: Record<string, V>, max = CACHE_MAX): Record<string, V> {
  const keys = Object.keys(m);
  if (keys.length <= max) return m;
  const out: Record<string, V> = {};
  for (const k of keys.slice(keys.length - max)) out[k] = m[k];
  return out;
}
