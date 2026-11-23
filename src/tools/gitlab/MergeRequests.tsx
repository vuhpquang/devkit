import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GitPullRequest, MessageSquare } from "lucide-react";
import { Badge, EmptyState, Notice, Panel, TextInput } from "../../lib/ui";
import {
  countBy,
  filterRows,
  fmtDur,
  mergeMrLists,
  mrDuration,
  mrQuery,
  mrSummary,
  mrWho,
  mrWhoLabel,
  nextSort,
  pool,
  projectUrl,
  rolesFor,
  sinceIso,
  sortRows,
  type Cache,
  type Client,
  type GitLabSettings,
  type MrRow,
} from "./logic";
import { Ext, ProjectCell, Stat, StatusBadge, StatusChips, Table, fmtT, saveCache, type Column } from "./parts";

type Prefs = GitLabSettings["mrs"];

export function MergeRequests({
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
  const [rows, setRows] = useState<MrRow[]>(() => cache.mrRows?.rows ?? []);
  const [msg, setMsg] = useState(() =>
    cache.mrRows ? `Cached at ${new Date(cache.mrRows.at).toLocaleTimeString()}` : "Press Load to fetch your merge requests.",
  );
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  const run = useCallback(async () => {
    if (busy.current || !conn.user.trim()) return;
    busy.current = true;
    onBusy(true, "Fetching merge requests…");
    setError(null);
    const t0 = performance.now();
    const user = conn.user.trim();
    const since = sinceIso(conn.days);
    const group = conn.group.trim();
    try {
      setMsg("Fetching merge requests…");
      const path = group ? `/groups/${encodeURIComponent(group)}/merge_requests` : "/merge_requests";
      const q = mrQuery(prefs.mstate, since);
      const lists = await Promise.all(rolesFor(prefs.role).map((role) => client.paged(path, { ...q, [`${role}_username`]: user }, 20)));
      const list = mergeMrLists(lists as Parameters<typeof mergeMrLists>[0], prefs.mstate);
      const base =
        `${list.length} merge requests (${prefs.role === "all" ? "all roles" : prefs.role}: ${user}, ` +
        `${since.slice(0, 10)} → today${group ? `, group ${group}` : ""})`;
      if (!alive.current) return;
      setRows(list);
      setMsg(`${base} — fetching pipelines…`);
      // The list API has no head pipeline: ask for each open MR.
      const open = list.filter((r) => r.state === "opened");
      let done = 0;
      await pool(open, 12, async (r) => {
        try {
          const m = await client.api<{ head_pipeline?: { status: string; web_url: string } | null }>(`/projects/${r.project_id}/merge_requests/${r.iid}`);
          r.pipeline = m.head_pipeline ? { status: m.head_pipeline.status, web_url: m.head_pipeline.web_url } : null;
        } catch {
          /* leave it blank */
        }
        if (++done % 10 === 0 && alive.current) setMsg(`${base} — pipelines ${done}/${open.length}…`);
      });
      cache.mrRows = { at: Date.now(), rows: list };
      saveCache(cache);
      if (!alive.current) return;
      setRows([...list]);
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
  }, [cache, client, conn.days, conn.group, conn.user, onBusy, prefs.mstate, prefs.role]);

  useEffect(() => {
    if (runToken > 0) void run();
    // Runs only when the parent asks (Load, auto refresh, role/state change, first open with a token).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runToken]);

  const user = conn.user.trim();
  const counts = useMemo(() => countBy(rows, (r) => r.state), [rows]);
  const summary = useMemo(() => mrSummary(rows), [rows]);
  const value = (r: MrRow): unknown =>
    prefs.sortKey === "_dur"
      ? mrDuration(r)
      : prefs.sortKey === "_who"
        ? mrWho(r, prefs.role, user)
        : prefs.sortKey === "_pipe"
          ? (r.pipeline?.status ?? "")
          : (r as unknown as Record<string, unknown>)[prefs.sortKey];
  const visible = sortRows(
    filterRows(rows, {
      status: prefs.state,
      statusOf: (r) => r.state,
      q: prefs.q,
      haystack: (r) => `${r.project} ${r.title} ${r.source_branch} ${r.target_branch}`,
    }),
    value,
    prefs.sortKey,
    prefs.sortDir,
  );

  const columns: Column<MrRow>[] = [
    { key: "updated_at", label: "Updated", className: "text-fg-muted tabular-nums", render: (r) => fmtT(r.updated_at) },
    { key: "project", label: "Project", className: "max-w-[16rem]", render: (r) => <ProjectCell path={r.project} href={projectUrl(r.web_url)} /> },
    { key: "iid", label: "MR", className: "tabular-nums", render: (r) => <Ext href={r.web_url}>!{r.iid}</Ext> },
    {
      key: "title",
      label: "Title",
      className: "max-w-[26rem]",
      render: (r) => (
        <Ext href={r.web_url} title={r.title} className="block truncate">
          {r.draft && <Badge className="mr-1.5 normal-case tracking-normal">Draft</Badge>}
          {r.state === "opened" && r.has_conflicts && (
            <Badge tone="danger" className="mr-1.5 normal-case tracking-normal">
              Conflict
            </Badge>
          )}
          {r.title}
        </Ext>
      ),
    },
    { key: "state", label: "State", render: (r) => <StatusBadge status={r.state} title={r.merge_status} /> },
    {
      key: "_pipe",
      label: "Pipeline",
      render: (r) =>
        r.pipeline ? (
          <Ext href={r.pipeline.web_url}>
            <StatusBadge status={r.pipeline.status} />
          </Ext>
        ) : null,
    },
    {
      key: "source_branch",
      label: "Branch",
      className: "max-w-[20rem] font-mono text-[12px]",
      render: (r) => (
        <span className="block truncate" title={`${r.source_branch} → ${r.target_branch}`}>
          {r.source_branch}
          <span className="text-fg-faint mx-1">→</span>
          {r.target_branch}
        </span>
      ),
    },
    { key: "_who", label: mrWhoLabel(prefs.role), className: "max-w-[12rem] text-fg-muted", render: (r) => <span className="block truncate">{mrWho(r, prefs.role, user)}</span> },
    {
      key: "user_notes_count",
      label: "Notes",
      className: "text-fg-muted tabular-nums",
      render: (r) =>
        r.user_notes_count ? (
          <span className="inline-flex items-center gap-1">
            <MessageSquare size={12} aria-hidden />
            {r.user_notes_count}
          </span>
        ) : null,
    },
    { key: "_dur", label: "Time", className: "text-fg-muted tabular-nums", render: (r) => fmtDur(mrDuration(r)) },
  ];

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <TextInput
          aria-label="Filter merge requests"
          placeholder="Filter by project, title or branch…"
          value={prefs.q}
          onChange={(e) => onPrefs({ q: e.target.value })}
          className="w-72"
        />
        <StatusChips counts={counts} active={prefs.state} onPick={(state) => onPrefs({ state })}>
          {rows.length > 0 && <Stat label="Projects" value={summary.projects} />}
          {summary.avgToMerge != null && <Stat label="Avg. to merge" value={fmtDur(summary.avgToMerge)} />}
          {summary.drafts > 0 && <Stat label="Drafts" value={summary.drafts} />}
          {summary.conflicts > 0 && <Stat label="Conflicts" value={summary.conflicts} />}
        </StatusChips>
      </div>
      {msg && <p className="text-sm text-fg-faint shrink-0 truncate" role="status">{msg}</p>}
      {error && <Notice>{error}</Notice>}
      <Panel className="flex-1" bodyClassName="overflow-auto">
        {rows.length ? (
          <Table columns={columns} rows={visible} rowKey={(r) => r.id} sortKey={prefs.sortKey} sortDir={prefs.sortDir} onSort={(k) => onPrefs(nextSort(prefs, k))} />
        ) : (
          <EmptyState icon={GitPullRequest} title="No merge requests yet">
            Press Load. Pick a role and a state to narrow the list.
          </EmptyState>
        )}
      </Panel>
    </>
  );
}
