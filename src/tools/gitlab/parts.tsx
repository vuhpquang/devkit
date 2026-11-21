import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Badge, cx } from "../../lib/ui";
import { openExternal } from "../../lib/openExternal";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { inApp } from "../../app/menuEvents";
import { parseCache, statusTone, trimMap, splitProject, type Cache, type Fetcher, type SortDir } from "./logic";

export const SETTINGS_KEY = "devkit.gitlab";
export const CACHE_KEY = "devkit.gitlab.cache";

/**
 * In the app: the Tauri HTTP plugin (Rust side, so no CORS preflight to fail and the token can ride in a header).
 * Its scope allows only GitLab API paths (`/api/v4/…`) over https, on any self-hosted instance
 * (src-tauri/capabilities/default.json). In a plain browser (`npm run dev`) the webview's fetch is used.
 */
export const browserFetch: Fetcher = (url, init) => (inApp() ? tauriFetch(url, init) : window.fetch(url, init));

export function loadCache(): Cache {
  try {
    return parseCache(localStorage.getItem(CACHE_KEY));
  } catch {
    return parseCache(null);
  }
}

export function saveCache(c: Cache) {
  c.commits = trimMap(c.commits);
  c.pipes = trimMap(c.pipes);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* full or blocked: the cache only saves time */
  }
}

/** "21/11 18:05" in the user's locale, 24 h. */
export function fmtT(t: string | number | null | undefined): string {
  if (t == null) return "";
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

/** A link that opens in the default browser instead of navigating the app's webview. */
export function Ext({ href, children, className, title }: { href: string; children: ReactNode; className?: string; title?: string }) {
  return (
    <a
      href={href}
      title={title}
      onClick={(e) => {
        e.preventDefault();
        void openExternal(href);
      }}
      className={cx("hover:text-accent-text hover:underline underline-offset-2 rounded-xs outline-none focus-visible:ring-2 focus-visible:ring-accent-ring", className)}
    >
      {children}
    </a>
  );
}

export function StatusBadge({ status, title }: { status: string; title?: string }) {
  return (
    <span title={title}>
      <Badge tone={statusTone(status)} className="normal-case tracking-normal">
        {status.replace(/_/g, " ")}
      </Badge>
    </span>
  );
}

export function ProjectCell({ path, href }: { path: string; href: string }) {
  const [ns, name] = splitProject(path);
  return (
    <Ext href={href} title={path} className="block truncate">
      <span className="text-fg-faint">{ns}</span>
      <span className="font-semibold text-fg">{name}</span>
    </Ext>
  );
}

/** Status filter chips with counts; the active one is highlighted, clicking it again clears it. */
export function StatusChips({
  counts,
  active,
  onPick,
  children,
}: {
  counts: [string, number][];
  active: string | null;
  onPick: (s: string | null) => void;
  children?: ReactNode;
}) {
  if (!counts.length && !children) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filter by status">
      {counts.map(([s, n]) => (
        <button
          key={s}
          type="button"
          aria-pressed={active === s}
          onClick={() => onPick(active === s ? null : s)}
          className={cx(
            "h-7 inline-flex items-center gap-1.5 pl-1 pr-2.5 rounded-full border text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent-ring transition-colors",
            active === s ? "bg-accent-soft border-accent/60 text-fg" : "bg-surface border-line text-fg-muted hover:border-accent/40",
          )}
        >
          <StatusBadge status={s} />
          <span className="tabular-nums font-medium">{n}</span>
        </button>
      ))}
      {children}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="h-7 inline-flex items-center gap-1.5 px-2.5 rounded-full bg-surface-3/70 text-sm text-fg-muted">
      {label}
      <b className="text-fg font-semibold tabular-nums">{value}</b>
    </span>
  );
}

export interface Column<T> {
  key: string;
  label: string;
  className?: string;
  render: (r: T) => ReactNode;
}

/** Sortable table: clicking a header sorts by it, clicking again flips the direction. */
export function Table<T>({
  columns,
  rows,
  rowKey,
  sortKey,
  sortDir,
  onSort,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (r: T) => string | number;
  sortKey: string;
  sortDir: SortDir;
  onSort: (key: string) => void;
}) {
  return (
    <table className="w-full text-base border-collapse">
      <thead className="sticky top-0 z-[1] bg-surface-2">
        <tr className="border-b border-line">
          {columns.map((c) => {
            const on = c.key === sortKey;
            return (
              <th
                key={c.key}
                aria-sort={on ? (sortDir < 0 ? "descending" : "ascending") : undefined}
                className={cx("text-left font-semibold text-xs uppercase tracking-[0.04em] text-fg-muted whitespace-nowrap p-0", c.className)}
              >
                <button
                  type="button"
                  onClick={() => onSort(c.key)}
                  className={cx(
                    "w-full h-8 px-3 inline-flex items-center gap-1 uppercase outline-none focus-visible:ring-2 focus-visible:ring-accent-ring hover:text-fg",
                    on && "text-fg",
                  )}
                >
                  {c.label}
                  {on && (sortDir < 0 ? <ArrowDown size={11} aria-hidden /> : <ArrowUp size={11} aria-hidden />)}
                </button>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((r) => (
          <tr key={rowKey(r)} className="hover:bg-surface-2/70">
            {columns.map((c) => (
              <td key={c.key} className={cx("px-3 py-2 whitespace-nowrap align-middle", c.className)}>
                {c.render(r)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
