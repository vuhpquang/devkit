import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCw, Workflow, X } from "lucide-react";
import { Button, EmptyState, Notice, Panel, TextInput } from "../../lib/ui";
import {
  CANCELABLE,
  RETRYABLE,
  TERMINAL,
  countBy,
  filterRows,
  fmtDur,
  nextSort,
  pipelineDuration,
  pipelineEnd,
  pool,
  projectUrl,
  refUrl,
  sinceIso,
  sortRows,
  type Cache,
  type Client,
  type GitLabSettings,
  type PipelineRow,
} from "./logic";
import { Ext, ProjectCell, StatusBadge, StatusChips, Table, fmtT, saveCache, type Column } from "./parts";

type Prefs = GitLabSettings["pipelines"];

interface ApiProject {
  id: number;
  path_with_namespace: string;
}
interface ApiPipeline {
  id: number;
  project_id: number;
  status: string;
  ref: string;
  sha: string;
  web_url: string;
  created_at: string;
  updated_at?: string;
  started_at?: string | null;
  finished_at?: string | null;
  duration?: number | null;
}

export function Pipelines({
  client,
  conn,
  prefs,
  onPrefs,
  runToken,
  onBusy,
  cache,
}: {
  client: Client;
  /** Connection plus this tab's own time window. */
  conn: Pick<GitLabSettings, "user" | "group"> & { days: number };
  prefs: Prefs;
  onPrefs: (p: Partial<Prefs>) => void;
  runToken: number;
  onBusy: (busy: boolean, summary: string) => void;
  cache: Cache;
}) {
  const [rows, setRows] = useState<PipelineRow[]>(() => cache.pipelineRows?.rows ?? []);
  const [msg, setMsg] = useState(() =>
    cache.pipelineRows ? `Cached at ${new Date(cache.pipelineRows.at).toLocaleTimeString()}` : "Press Load to fetch your pipelines.",
  );
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [acting, setActing] = useState<number | null>(null);
  const [, tick] = useState(0);
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  // Running pipelines' durations keep counting.
  useEffect(() => {
    if (!rows.some((r) => r.status === "running")) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [rows]);

  const userId = useCallback(async () => {
    if (cache.uid && cache.uid.name === conn.user) return cache.uid.id;
    const u = await client.api<{ id: number }[]>("/users", { username: conn.user });
    if (!u[0]) throw new Error(`GitLab has no user "${conn.user}". Check the username.`);
    cache.uid = { name: conn.user, id: u[0].id };
    return u[0].id;
  }, [cache, client, conn.user]);

  /** Fast scan: projects with the user's recent activity (events) plus projects that had their pipelines before. */
  const activeProjectIds = useCallback(
    async (since: string): Promise<Set<number> | null> => {
      try {
        const uid = await userId();
        const after = new Date(Date.parse(since) - 864e5).toISOString().slice(0, 10);
        const ev = await client.paged<{ project_id?: number }>(`/users/${uid}/events`, { after }, 10);
        const ids = new Set(ev.map((e) => e.project_id).filter((x): x is number => typeof x === "number"));
        for (const id of cache.known) ids.add(id);
        return ids;
      } catch {
        return null;
      }
    },
    [cache, client, userId],
  );

  /** Commit titles and timings aren't in the list API: fetch them, cache what can't change. */
  const enrich = useCallback(
    async (list: PipelineRow[], base: string) => {
      let done = 0;
      await pool(list, 12, async (r) => {
        const ck = `${r.project_id}:${r.sha}`;
        const pk = `${r.project_id}:${r.id}`;
        if (cache.commits[ck] == null) {
          try {
            cache.commits[ck] = (await client.api<{ title?: string }>(`/projects/${r.project_id}/repository/commits/${r.sha}`)).title || "";
          } catch {
            /* keep going without the title */
          }
        }
        r.commit = cache.commits[ck] || "";
        const hit = cache.pipes[pk];
        if (hit) Object.assign(r, hit);
        else {
          try {
            const p = await client.api<ApiPipeline>(`/projects/${r.project_id}/pipelines/${r.id}`);
            const d = { duration: p.duration, started_at: p.started_at, finished_at: p.finished_at };
            Object.assign(r, d, { status: p.status });
            if (TERMINAL.has(p.status)) cache.pipes[pk] = d;
          } catch {
            /* keep the list values */
          }
        }
        if (++done % 10 === 0 && alive.current) setMsg(`${base} — commits and durations ${done}/${list.length}…`);
      });
      saveCache(cache);
    },
    [cache, client],
  );

  const run = useCallback(async () => {
    if (busy.current || !conn.user.trim()) return;
    busy.current = true;
    onBusy(true, "Listing projects…");
    setError(null);
    const t0 = performance.now();
    const since = sinceIso(conn.days);
    const group = conn.group.trim();
    const fast = prefs.mode === "fast";
    try {
      setMsg("Listing projects…");
      const listP = group
        ? client.paged<ApiProject>(`/groups/${encodeURIComponent(group)}/projects`, {
            include_subgroups: true,
            simple: true,
            archived: false,
            last_activity_after: since,
          })
        : client.paged<ApiProject>("/projects", { membership: true, simple: true, archived: false, last_activity_after: since });
      const [projects, ids] = await Promise.all([listP, fast ? activeProjectIds(since) : Promise.resolve(null)]);
      const targets = ids ? projects.filter((p) => ids.has(p.id)) : projects;
      const out: PipelineRow[] = [];
      let done = 0;
      let failed = 0;
      await pool(targets, 12, async (p) => {
        try {
          const list = await client.paged<ApiPipeline>(
            `/projects/${p.id}/pipelines`,
            { username: conn.user.trim(), updated_after: since, order_by: "id", sort: "desc" },
            5,
          );
          for (const x of list) out.push({ ...x, project: p.path_with_namespace });
        } catch {
          failed++;
        }
        done++;
        if (alive.current) {
          const m = `Scanning ${done}/${targets.length} projects… (${out.length} pipelines)`;
          setMsg(m);
          onBusy(true, m);
        }
      });
      cache.known = [...new Set([...cache.known, ...out.map((r) => r.project_id)])];
      const base =
        `${out.length} pipelines from ${targets.length}/${projects.length} projects${ids ? "" : " (full scan)"} ` +
        `(${since.slice(0, 10)} → today)` +
        (failed ? `, ${failed} projects failed or not allowed` : "");
      if (!alive.current) return;
      setRows([...out]);
      setMsg(`${base} — fetching commits and durations…`);
      await enrich(out, base);
      cache.pipelineRows = { at: Date.now(), rows: out };
      saveCache(cache);
      if (!alive.current) return;
      setRows([...out]);
      setMsg(`${base}. Updated ${new Date().toLocaleTimeString()} (${((performance.now() - t0) / 1000).toFixed(1)}s)`);
    } catch (e) {
      if (alive.current) {
        setError((e as Error).message);
        setMsg("");
      }
    } finally {
      busy.current = false;
      onBusy(false, "");
    }
  }, [activeProjectIds, cache, client, conn.days, conn.group, conn.user, enrich, onBusy, prefs.mode]);

  useEffect(() => {
    if (runToken > 0) void run();
    // Runs only when the parent asks (Load, auto refresh, first open with a token).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runToken]);

  /** Retry or cancel, then update the row from GitLab's answer. */
  const act = async (r: PipelineRow, action: "retry" | "cancel") => {
    setConfirming(null);
    setActing(r.id);
    try {
      const x = await client.api<ApiPipeline>(`/projects/${r.project_id}/pipelines/${r.id}/${action}`, {}, "POST");
      Object.assign(r, { status: x.status, duration: x.duration, started_at: x.started_at, finished_at: x.finished_at, updated_at: x.updated_at });
      delete cache.pipes[`${r.project_id}:${r.id}`];
      if (cache.pipelineRows) cache.pipelineRows.rows = rows;
      saveCache(cache);
      setRows((prev) => [...prev]);
      setMsg(`${action === "retry" ? "Retried" : "Cancelled"} pipeline #${r.id} → ${x.status}`);
    } catch (e) {
      setError(`Couldn't ${action} #${r.id}: ${(e as Error).message} The token needs the api scope and Developer access.`);
    } finally {
      setActing(null);
    }
  };

  const counts = useMemo(() => countBy(rows, (r) => r.status), [rows]);
  const visible = sortRows(
    filterRows(rows, { status: prefs.status, statusOf: (r) => r.status, q: prefs.q, haystack: (r) => `${r.project} ${r.ref} ${r.commit ?? ""}` }),
    (r) => (prefs.sortKey === "_dur" ? pipelineDuration(r) : prefs.sortKey === "_end" ? pipelineEnd(r) : (r as unknown as Record<string, unknown>)[prefs.sortKey]),
    prefs.sortKey,
    prefs.sortDir,
  );

  const columns: Column<PipelineRow>[] = [
    { key: "created_at", label: "Created", className: "text-fg-muted tabular-nums", render: (r) => fmtT(r.created_at) },
    { key: "project", label: "Project", className: "max-w-[18rem]", render: (r) => <ProjectCell path={r.project} href={projectUrl(r.web_url)} /> },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <span className="inline-flex items-center gap-1">
          <Ext href={r.web_url} title={`Pipeline #${r.id}`}>
            <StatusBadge status={r.status} />
          </Ext>
          {confirming === r.id ? (
            <span className="inline-flex items-center gap-1 ml-1 text-sm">
              Cancel #{r.id}?
              <Button size="sm" variant="primary" onClick={() => void act(r, "cancel")}>
                Cancel pipeline
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                Keep
              </Button>
            </span>
          ) : (
            <>
              {RETRYABLE.has(r.status) && (
                <Button size="sm" variant="ghost" icon={RotateCw} label={`Retry pipeline #${r.id}`} disabled={acting === r.id} onClick={() => void act(r, "retry")} />
              )}
              {CANCELABLE.has(r.status) && (
                <Button size="sm" variant="ghost" icon={X} label={`Cancel pipeline #${r.id}`} disabled={acting === r.id} onClick={() => setConfirming(r.id)} />
              )}
            </>
          )}
        </span>
      ),
    },
    {
      key: "ref",
      label: "Ref",
      className: "max-w-[16rem] font-mono text-[12px]",
      render: (r) => (
        <Ext href={refUrl(projectUrl(r.web_url), r.ref)} title={r.ref} className="block truncate">
          {r.ref}
        </Ext>
      ),
    },
    {
      key: "commit",
      label: "Commit",
      className: "max-w-[26rem]",
      render: (r) => (
        <Ext href={`${projectUrl(r.web_url)}/-/commit/${r.sha}`} title={r.commit} className="block truncate">
          <code className="font-mono text-[11px] text-fg-muted bg-surface-3/70 rounded-xs px-1.5 py-px mr-2">{(r.sha || "").slice(0, 8)}</code>
          {r.commit}
        </Ext>
      ),
    },
    {
      key: "_end",
      label: "Finished · duration",
      className: "text-fg-muted tabular-nums",
      render: (r) => {
        const end = pipelineEnd(r);
        const dur = pipelineDuration(r);
        return (
          <span title={end ?? ""}>
            {end ? fmtT(end) : r.status === "running" ? <span className="text-info">running</span> : ""}
            {dur != null && <span className="ml-2 pl-2 border-l border-line">{fmtDur(dur)}</span>}
          </span>
        );
      },
    },
  ];

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <TextInput
          aria-label="Filter pipelines"
          placeholder="Filter by project, ref or commit…"
          value={prefs.q}
          onChange={(e) => onPrefs({ q: e.target.value })}
          className="w-72"
        />
        <StatusChips counts={counts} active={prefs.status} onPick={(status) => onPrefs({ status })} />
      </div>
      {msg && <p className="text-sm text-fg-faint shrink-0 truncate" role="status">{msg}</p>}
      {error && <Notice>{error}</Notice>}
      <Panel className="flex-1" bodyClassName="overflow-auto">
        {rows.length ? (
          <Table
            columns={columns}
            rows={visible}
            rowKey={(r) => `${r.project_id}:${r.id}`}
            sortKey={prefs.sortKey}
            sortDir={prefs.sortDir}
            onSort={(k) => onPrefs(nextSort(prefs, k))}
          />
        ) : (
          <EmptyState icon={Workflow} title="No pipelines yet">
            Press Load. Fast scan looks only at projects you've been active in; switch to Full scan to check every project.
          </EmptyState>
        )}
      </Panel>
    </>
  );
}
