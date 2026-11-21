import { describe, it, expect, vi } from "vitest";
import {
  DEFAULT_SETTINGS,
  apiUrl,
  countBy,
  createClient,
  describeError,
  fmtDur,
  filterRows,
  isConfigured,
  mergeMrLists,
  mrDuration,
  mrQuery,
  mrSummary,
  mrWho,
  nextSort,
  normalizeBase,
  parseCache,
  parseSettings,
  pipelineDuration,
  pipelineEnd,
  pool,
  projectUrl,
  refUrl,
  rolesFor,
  sortRows,
  splitProject,
  statusTone,
  trimMap,
  type MrRow,
  type PipelineRow,
} from "./logic";

const BASE = "https://gitlab.example.com";

describe("settings", () => {
  it("defaults to nothing filled in", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.base).toBe("");
    expect(DEFAULT_SETTINGS.user).toBe("");
  });

  it("keeps valid values and repairs bad ones", () => {
    const s = parseSettings(JSON.stringify({ base: BASE, days: 999, auto: 7, tab: "mrs", mrs: { role: "reviewer", sortDir: 3 } }));
    expect(s.base).toBe(BASE);
    expect(s.days).toBe(30);
    expect(s.auto).toBe(0);
    expect(s.tab).toBe("mrs");
    expect(s.mrs.role).toBe("reviewer");
    expect(s.mrs.sortDir).toBe(-1);
    expect(parseSettings("{nope").tab).toBe("pipelines");
  });

  it("needs a URL, a token and a username", () => {
    expect(isConfigured({ base: BASE, token: "t", user: "u" })).toBe(true);
    expect(isConfigured({ base: "gitlab", token: "t", user: "u" })).toBe(false);
    expect(isConfigured({ base: BASE, token: " ", user: "u" })).toBe(false);
  });

  it("normalises the base URL", () => {
    expect(normalizeBase(` ${BASE}/// `)).toBe(BASE);
    expect(normalizeBase("ftp://x")).toBeNull();
    expect(normalizeBase("http://gitlab.example.com")).toBeNull();
    expect(normalizeBase("http://localhost:8080")).toBe("http://localhost:8080");
    expect(normalizeBase("")).toBeNull();
  });
});

describe("apiUrl", () => {
  it("keeps the token out of the URL and adds a slash to one-segment paths", () => {
    const u = new URL(apiUrl(BASE + "/", "/projects", { membership: true, per_page: 100 }));
    expect(u.pathname).toBe("/api/v4/projects/");
    expect(u.searchParams.get("membership")).toBe("true");
    expect(u.searchParams.has("private_token")).toBe(false);
  });

  it("leaves deeper paths alone", () => {
    expect(new URL(apiUrl(BASE, "/projects/12/pipelines/34/retry")).pathname).toBe("/api/v4/projects/12/pipelines/34/retry");
  });

  it("asks for a URL when there is none", () => {
    expect(() => apiUrl("", "/projects")).toThrow(/GitLab URL/);
  });
});

describe("client", () => {
  it("pages until a short page and passes simple requests", async () => {
    const calls: { url: string; method: string }[] = [];
    const fetcher = vi.fn(async (url: string, init: { method: string }) => {
      calls.push({ url, method: init.method });
      const page = Number(new URL(url).searchParams.get("page"));
      const data = Array.from({ length: page === 1 ? 100 : 7 }, (_, i) => ({ id: page * 1000 + i }));
      return { ok: true, status: 200, json: async () => data };
    });
    const c = createClient({ base: BASE, token: "t" }, fetcher);
    const all = await c.paged("/projects", { simple: true });
    expect(all).toHaveLength(107);
    expect(calls).toHaveLength(2);
    expect(calls.every((x) => x.method === "GET")).toBe(true);
  });

  it("turns HTTP and network failures into messages saying what to check", async () => {
    const bad = createClient({ base: BASE, token: "t" }, async () => ({ ok: false, status: 401, json: async () => ({}) }));
    await expect(bad.api("/users")).rejects.toThrow(/token/);
    const down = createClient({ base: BASE, token: "t" }, async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(down.api("/users")).rejects.toThrow(/GitLab URL/);
    expect(describeError(403, "/x")).toMatch(/read_api/);
  });
});

describe("pool", () => {
  it("never runs more than n at once and visits every item", async () => {
    let live = 0;
    let peak = 0;
    const seen: number[] = [];
    await pool([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      live++;
      peak = Math.max(peak, live);
      await new Promise((r) => setTimeout(r, 1));
      seen.push(n);
      live--;
    });
    expect(peak).toBe(3);
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("formatting", () => {
  it("formats durations", () => {
    expect(fmtDur(null)).toBe("");
    expect(fmtDur(42)).toBe("42s");
    expect(fmtDur(125)).toBe("2m 5s");
    expect(fmtDur(3700)).toBe("1h 1m");
    expect(fmtDur(90000)).toBe("1d 1h");
  });

  it("splits project paths and finds project URLs", () => {
    expect(splitProject("team/sub/app")).toEqual(["team/sub/", "app"]);
    expect(splitProject("app")).toEqual(["", "app"]);
    expect(projectUrl(`${BASE}/team/app/-/pipelines/9`)).toBe(`${BASE}/team/app`);
  });

  it("links MR pipelines to the MR and branches to their tree", () => {
    expect(refUrl("P", "refs/merge-requests/12/head")).toBe("P/-/merge_requests/12");
    expect(refUrl("P", "feature/a b")).toBe("P/-/tree/feature/a%20b");
  });

  it("colours statuses", () => {
    expect(statusTone("success")).toBe("success");
    expect(statusTone("failed")).toBe("danger");
    expect(statusTone("running")).toBe("info");
    expect(statusTone("waiting_for_resource")).toBe("accent");
    expect(statusTone("canceled")).toBe("neutral");
    expect(statusTone("merged")).toBe("success");
  });
});

const pipe = (p: Partial<PipelineRow>): PipelineRow => ({
  id: 1,
  project_id: 1,
  project: "team/app",
  status: "success",
  ref: "main",
  sha: "abc",
  web_url: `${BASE}/team/app/-/pipelines/1`,
  created_at: "2026-01-01T00:00:00Z",
  ...p,
});

describe("pipelines", () => {
  it("counts a running pipeline from its start", () => {
    const now = Date.parse("2026-01-01T00:05:00Z");
    expect(pipelineDuration(pipe({ duration: 30 }), now)).toBe(30);
    expect(pipelineDuration(pipe({ status: "running", started_at: "2026-01-01T00:00:00Z" }), now)).toBe(300);
    expect(pipelineDuration(pipe({ status: "pending" }), now)).toBeNull();
  });

  it("uses updated_at as the end of a finished pipeline without finished_at", () => {
    expect(pipelineEnd(pipe({ finished_at: "F" }))).toBe("F");
    expect(pipelineEnd(pipe({ status: "canceled", updated_at: "U" }))).toBe("U");
    expect(pipelineEnd(pipe({ status: "running", updated_at: "U" }))).toBeNull();
  });

  it("counts, filters and sorts", () => {
    const rows = [
      pipe({ id: 1, status: "failed", ref: "main", duration: 10 }),
      pipe({ id: 2, status: "success", ref: "feature/login", duration: 50 }),
      pipe({ id: 3, status: "success", ref: "main", duration: null }),
    ];
    expect(countBy(rows, (r) => r.status)).toEqual([
      ["success", 2],
      ["failed", 1],
    ]);
    const filtered = filterRows(rows, { status: "success", statusOf: (r) => r.status, q: "LOGIN", haystack: (r) => `${r.project} ${r.ref}` });
    expect(filtered.map((r) => r.id)).toEqual([2]);
    const byDur = sortRows(rows, (r) => r.duration, "_dur", -1);
    expect(byDur.map((r) => r.id)).toEqual([2, 1, 3]);
    expect(nextSort({ sortKey: "_dur", sortDir: -1 }, "_dur")).toEqual({ sortKey: "_dur", sortDir: 1 });
    expect(nextSort({ sortKey: "_dur", sortDir: 1 }, "ref")).toEqual({ sortKey: "ref", sortDir: -1 });
  });
});

const apiMr = (m: Record<string, unknown>) => ({
  id: 1,
  iid: 1,
  project_id: 1,
  title: "Add login",
  state: "opened",
  web_url: `${BASE}/team/app/-/merge_requests/1`,
  references: { full: "team/app!1" },
  source_branch: "feature/login",
  target_branch: "main",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  author: { username: "alice" },
  reviewers: [{ username: "bob" }],
  ...m,
});

describe("merge requests", () => {
  it("merges role lists by id, newest first, and keeps only conflicts for that filter", () => {
    const a = [apiMr({ id: 1, updated_at: "2026-01-02T00:00:00Z" }), apiMr({ id: 2, updated_at: "2026-01-05T00:00:00Z", has_conflicts: true })];
    const b = [apiMr({ id: 2, updated_at: "2026-01-05T00:00:00Z", has_conflicts: true })];
    expect(mergeMrLists([a, b], "all").map((r) => r.id)).toEqual([2, 1]);
    expect(mergeMrLists([a, b], "conflict").map((r) => r.id)).toEqual([2]);
    const row = mergeMrLists([a], "all")[1];
    expect(row.project).toBe("team/app");
    expect(row.reviewers).toEqual(["bob"]);
  });

  it("builds the list query", () => {
    expect(mrQuery("conflict", "S").state).toBe("opened");
    expect(mrQuery("all", "S")).not.toHaveProperty("state");
    expect(rolesFor("all")).toEqual(["author", "assignee", "reviewer"]);
    expect(rolesFor("reviewer")).toEqual(["reviewer"]);
  });

  it("measures time to merge, to close, or age", () => {
    const [m] = mergeMrLists([[apiMr({ state: "merged", merged_at: "2026-01-01T02:00:00Z" })]], "all");
    expect(mrDuration(m)).toBe(7200);
    const [o] = mergeMrLists([[apiMr({})]], "all");
    expect(mrDuration(o, Date.parse("2026-01-01T00:01:00Z"))).toBe(60);
  });

  it("shows reviewers for your own MRs and the author for others", () => {
    const [r] = mergeMrLists([[apiMr({})]], "all") as MrRow[];
    expect(mrWho(r, "all", "alice")).toBe("bob");
    expect(mrWho(r, "all", "carol")).toBe("alice");
    expect(mrWho(r, "author", "carol")).toBe("bob");
    expect(mrWho(r, "reviewer", "bob")).toBe("alice");
  });

  it("summarises projects, time to merge, drafts and conflicts", () => {
    const rows = mergeMrLists(
      [
        [
          apiMr({ id: 1, state: "merged", merged_at: "2026-01-01T01:00:00Z" }),
          apiMr({ id: 2, state: "merged", merged_at: "2026-01-01T03:00:00Z", references: { full: "team/web!2" } }),
          apiMr({ id: 3, draft: true, has_conflicts: true }),
        ],
      ],
      "all",
    );
    expect(mrSummary(rows)).toEqual({ projects: 2, avgToMerge: 7200, drafts: 1, conflicts: 1 });
  });
});

describe("cache", () => {
  it("survives garbage and trims old entries", () => {
    expect(parseCache("{bad")).toEqual({ commits: {}, pipes: {}, known: [] });
    expect(parseCache(JSON.stringify({ known: [1, "x", 2] })).known).toEqual([1, 2]);
    const m = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`k${i}`, i]));
    expect(Object.keys(trimMap(m, 3))).toEqual(["k2", "k3", "k4"]);
  });
});
