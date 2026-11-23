import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GitMerge, PlugZap, RefreshCw, Settings2 } from "lucide-react";
import type { ToolDef } from "../types";
import { Button, EmptyState, Field, Panel, Segmented, Select, Spinner, TextInput, ToolBar, ToolPage, cx } from "../../lib/ui";
import { createClient, isConfigured, normalizeBase, parseSettings, type GitLabSettings, type MrStateFilter, type Role, type ScanMode, type Tab, type TabWindow } from "./logic";
import { SETTINGS_KEY, browserFetch, loadCache } from "./parts";
import { Pipelines } from "./Pipelines";
import { MergeRequests } from "./MergeRequests";

function useGitLabSettings() {
  const [s, setS] = useState<GitLabSettings>(() => {
    try {
      return parseSettings(localStorage.getItem(SETTINGS_KEY));
    } catch {
      return parseSettings(null);
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch {
      /* blocked storage: settings last for this session */
    }
  }, [s]);
  return [s, setS] as const;
}

/** Parses the Days field: a whole number 1–365, otherwise null (the field keeps what was typed). */
export function parseDays(text: string): number | null {
  if (!/^\s*\d+\s*$/.test(text)) return null;
  const n = Number(text);
  return n >= 1 && n <= 365 ? n : null;
}

/**
 * Keeps the typed text while editing (clearing the field no longer snaps it to 30), saves only valid values, and
 * shows the saved value again when focus leaves.
 */
function DaysInput({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  const [text, setText] = useState(String(value));
  const invalid = parseDays(text) === null;
  return (
    <TextInput
      type="number"
      min={1}
      max={365}
      value={text}
      aria-invalid={invalid || undefined}
      onChange={(e) => {
        setText(e.target.value);
        const days = parseDays(e.target.value);
        if (days !== null) onChange(days);
      }}
      onBlur={() => setText(String(parseDays(text) ?? value))}
      className="w-20 text-right tabular-nums"
    />
  );
}

function GitLab() {
  const [s, setS] = useGitLabSettings();
  const patch = useCallback((p: Partial<GitLabSettings>) => setS((prev) => ({ ...prev, ...p })), [setS]);
  const cache = useRef(loadCache()).current;
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [runs, setRuns] = useState<Record<Tab, number>>({ pipelines: 0, mrs: 0 });
  const configured = isConfigured(s);
  const client = useMemo(() => createClient({ base: s.base, token: s.token }, browserFetch), [s.base, s.token]);

  const load = useCallback((tab: Tab) => setRuns((r) => ({ ...r, [tab]: r[tab] + 1 })), []);
  const onBusy = useCallback((b: boolean, summary: string) => {
    setBusy(b);
    setProgress(summary);
  }, []);

  // Like the original pages: opening a tab with a token loads it straight away.
  const firstOpen = useRef<Record<Tab, boolean>>({ pipelines: false, mrs: false });
  useEffect(() => {
    if (configured && !firstOpen.current[s.tab]) {
      firstOpen.current[s.tab] = true;
      load(s.tab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.tab]);

  // Days and Auto refresh belong to the open tab.
  const win = s.tab === "pipelines" ? s.pipelines : s.mrs;
  const patchWin = (p: Partial<TabWindow>) =>
    setS((prev) => (prev.tab === "pipelines" ? { ...prev, pipelines: { ...prev.pipelines, ...p } } : { ...prev, mrs: { ...prev.mrs, ...p } }));

  // Auto refresh the open tab at its own rate.
  useEffect(() => {
    if (!win.auto || !configured) return;
    const id = setInterval(() => load(s.tab), win.auto * 1000);
    return () => clearInterval(id);
  }, [win.auto, s.tab, configured, load]);
  const baseInvalid = s.base.trim() !== "" && !normalizeBase(s.base);

  return (
    <ToolPage>
      <ToolBar
        end={
          <>
            {busy && (
              <span className="flex items-center gap-2 text-sm text-fg-faint max-w-[22rem] truncate">
                <Spinner /> {progress}
              </span>
            )}
            <Button size="sm" variant="ghost" icon={RefreshCw} label="Reload" disabled={!configured || busy} onClick={() => load(s.tab)} />
            <Button
              size="sm"
              variant="ghost"
              icon={Settings2}
              label={s.collapsed ? "Show connection" : "Hide connection"}
              aria-pressed={!s.collapsed}
              className={cx(!s.collapsed && "!text-accent-text !bg-accent-soft")}
              onClick={() => patch({ collapsed: !s.collapsed })}
            />
          </>
        }
      >
        <Segmented<Tab>
          label="View"
          value={s.tab}
          onChange={(tab) => patch({ tab })}
          options={[
            { value: "pipelines", label: "Pipelines" },
            { value: "mrs", label: "Merge requests" },
          ]}
        />
      </ToolBar>

      {!s.collapsed && (
        <Panel className="shrink-0" bodyClassName="p-3">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (configured) load(s.tab);
            }}
          >
            <Field label="GitLab URL" hint={baseInvalid ? <span className="text-danger">Not a URL — include https://</span> : undefined}>
              <TextInput
                value={s.base}
                onChange={(e) => patch({ base: e.target.value })}
                placeholder="https://gitlab.example.com"
                className="w-64"
                mono
              />
            </Field>
            <Field label="Access token">
              <TextInput type="password" value={s.token} onChange={(e) => patch({ token: e.target.value })} placeholder="glpat-…" className="w-52" mono />
            </Field>
            <Field label="Username">
              <TextInput value={s.user} onChange={(e) => patch({ user: e.target.value })} placeholder="your.username" className="w-36" />
            </Field>
            <Field label="Group (optional)">
              <TextInput value={s.group} onChange={(e) => patch({ group: e.target.value })} placeholder="group/subgroup" className="w-40" />
            </Field>
            <Field label="Days">
              <DaysInput key={s.tab} value={win.days} onChange={(days) => patchWin({ days })} />
            </Field>
            {s.tab === "pipelines" ? (
              <Field label="Scan">
                <Select
                  aria-label="Scan"
                  value={s.pipelines.mode}
                  onChange={(e) => patch({ pipelines: { ...s.pipelines, mode: e.target.value as ScanMode } })}
                  className="w-56"
                >
                  <option value="fast">Fast — projects you were active in</option>
                  <option value="full">Full — every project</option>
                </Select>
              </Field>
            ) : (
              <>
                <Field label="Role">
                  <Select
                    aria-label="Role"
                    value={s.mrs.role}
                    onChange={(e) => {
                      patch({ mrs: { ...s.mrs, role: e.target.value as Role } });
                      if (configured) load("mrs");
                    }}
                    className="w-32"
                  >
                    <option value="all">All roles</option>
                    <option value="author">Author</option>
                    <option value="assignee">Assignee</option>
                    <option value="reviewer">Reviewer</option>
                  </Select>
                </Field>
                <Field label="State">
                  <Select
                    aria-label="State"
                    value={s.mrs.mstate}
                    onChange={(e) => {
                      patch({ mrs: { ...s.mrs, mstate: e.target.value as MrStateFilter } });
                      if (configured) load("mrs");
                    }}
                    className="w-32"
                  >
                    <option value="all">All</option>
                    <option value="opened">Open</option>
                    <option value="merged">Merged</option>
                    <option value="closed">Closed</option>
                    <option value="conflict">Conflict</option>
                  </Select>
                </Field>
              </>
            )}
            <Field label="Auto refresh">
              <Select aria-label="Auto refresh" value={win.auto} onChange={(e) => patchWin({ auto: Number(e.target.value) })} className="w-28">
                <option value={0}>Off</option>
                <option value={60}>1 minute</option>
                <option value={180}>3 minutes</option>
                <option value={300}>5 minutes</option>
              </Select>
            </Field>
            <Button type="submit" variant="primary" disabled={!configured || busy} kbd={busy ? undefined : "↵"}>
              {busy && <Spinner />}
              {busy ? "Loading…" : "Load"}
            </Button>
          </form>
          <p className="text-sm text-fg-faint mt-2.5">
            Token scopes: read_api to list, api to retry or cancel pipelines. URL and token are stored on this Mac only.
          </p>
        </Panel>
      )}

      {!configured ? (
        <EmptyState icon={PlugZap} title="Connect to GitLab" className="flex-1">
          Enter your GitLab URL, a personal access token and your username, then press Load. Works with gitlab.com and
          self-hosted GitLab.
        </EmptyState>
      ) : s.tab === "pipelines" ? (
        <Pipelines
          client={client}
          conn={{ user: s.user, group: s.group, days: s.pipelines.days }}
          prefs={s.pipelines}
          onPrefs={(p) => setS((prev) => ({ ...prev, pipelines: { ...prev.pipelines, ...p } }))}
          runToken={runs.pipelines}
          onBusy={onBusy}
          cache={cache}
        />
      ) : (
        <MergeRequests
          client={client}
          conn={{ user: s.user, group: s.group, days: s.mrs.days }}
          prefs={s.mrs}
          onPrefs={(p) => setS((prev) => ({ ...prev, mrs: { ...prev.mrs, ...p } }))}
          runToken={runs.mrs}
          onBusy={onBusy}
          cache={cache}
        />
      )}
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "gitlab",
  name: "GitLab",
  category: "Network",
  description: "Your pipelines and merge requests across every project",
  icon: GitMerge,
  keywords: ["gitlab", "pipeline", "ci", "merge request", "mr", "retry", "cancel", "review"],
  online: true,
  component: GitLab,
};
