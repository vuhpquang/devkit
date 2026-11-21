import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Search } from "lucide-react";
import { tools } from "../tools/registry";
import type { ToolDef } from "../tools/types";
import { Badge, cx, IconTile, Kbd, OnlineBadge } from "../lib/ui";
import { usePrefs } from "./prefs";
import { searchTools } from "./search";
import { isToolSearchable, isToolVisible, useSettings, type Settings } from "./settings";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
}

type Row = { kind: "heading"; label: string } | { kind: "tool"; tool: ToolDef; index: number };

/** Builds the visible rows: recent first when there's no query, ranked results otherwise. */
function buildRows(query: string, recentIds: string[], settings: Settings): { rows: Row[]; items: ToolDef[] } {
  const pool = tools.filter((t) => isToolSearchable(t, settings));
  const rows: Row[] = [];
  const items: ToolDef[] = [];
  const add = (label: string, list: ToolDef[]) => {
    if (list.length === 0) return;
    rows.push({ kind: "heading", label });
    for (const tool of list) {
      rows.push({ kind: "tool", tool, index: items.length });
      items.push(tool);
    }
  };
  if (query.trim()) {
    add("Tools", searchTools(pool, query));
  } else {
    const recent = recentIds.map((id) => pool.find((t) => t.id === id)).filter((t): t is ToolDef => !!t);
    add("Recent", recent);
    add(recent.length ? "All tools" : "Tools", pool.filter((t) => !recent.includes(t)));
  }
  return { rows, items };
}

export function CommandPalette({ open, onClose, onSelect }: Props) {
  if (!open) return null;
  return <PaletteBody onClose={onClose} onSelect={onSelect} />;
}

function PaletteBody({ onClose, onSelect }: Omit<Props, "open">) {
  const { recent } = usePrefs();
  const { settings } = useSettings();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const { rows, items } = useMemo(() => buildRows(q, recent, settings), [q, recent, settings]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  const choose = (t: ToolDef | undefined) => {
    if (!t) return;
    onSelect(t.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-scrim dk-fade-in flex items-start justify-center pt-[14vh] px-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Jump to a tool"
        className="w-[36rem] max-w-full rounded-xl bg-surface border border-line shadow-pop overflow-hidden dk-pop-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 h-[52px] border-b border-line">
          <Search size={18} className="text-fg-faint shrink-0" aria-hidden />
          <input
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls="palette-list"
            aria-activedescendant={items[active] ? `palette-${items[active].id}` : undefined}
            className="flex-1 bg-transparent outline-none text-md text-fg placeholder:text-fg-faint"
            placeholder="Jump to a tool…"
            spellCheck={false}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                choose(items[active]);
              }
            }}
          />
          <Kbd>esc</Kbd>
        </div>

        <div ref={listRef} id="palette-list" role="listbox" className="max-h-[min(26rem,60vh)] overflow-y-auto p-1.5">
          {items.length === 0 && (
            <p className="px-3 py-8 text-center text-base text-fg-faint">No tools match “{q.trim()}”</p>
          )}
          {rows.map((r) =>
            r.kind === "heading" ? (
              <div key={`h-${r.label}`} className="px-2.5 pt-2 pb-1 text-xs font-semibold text-fg-faint">
                {r.label}
              </div>
            ) : (
              <div
                key={r.tool.id}
                id={`palette-${r.tool.id}`}
                role="option"
                aria-selected={r.index === active}
                data-index={r.index}
                onMouseMove={() => setActive(r.index)}
                onClick={() => choose(r.tool)}
                className={cx(
                  "flex items-center gap-3 px-2.5 h-11 rounded-lg",
                  r.index === active ? "bg-accent-soft" : "",
                )}
              >
                <IconTile icon={r.tool.icon} size={26} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium text-fg truncate">{r.tool.name}</span>
                    {r.tool.online && <OnlineBadge />}
                    {!isToolVisible(r.tool, settings) && <Badge>Hidden</Badge>}
                  </div>
                  <div className="text-sm text-fg-faint truncate">{r.tool.description}</div>
                </div>
                <span className="text-sm text-fg-faint shrink-0">{r.tool.category}</span>
                {r.index === active && <CornerDownLeft size={14} className="text-fg-faint shrink-0" aria-hidden />}
              </div>
            ),
          )}
        </div>

        <div className="flex items-center gap-4 px-4 h-9 border-t border-line bg-surface-2/60 text-sm text-fg-faint">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> to move
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd> to open
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>esc</Kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
}
