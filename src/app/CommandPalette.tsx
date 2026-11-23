import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardPaste, CornerDownLeft, Search } from "lucide-react";
import { tools } from "../tools/registry";
import type { ToolDef } from "../tools/types";
import { Badge, cx, IconTile, Kbd, OnlineBadge } from "../lib/ui";
import { readClipboardText } from "../lib/clipboard";
import { usePrefs } from "./prefs";
import { searchTools } from "./search";
import { isToolSearchable, isToolVisible, useSettings, type Settings } from "./settings";
import { detectClipboard, type ClipboardSuggestion } from "./clipboard";

/** One choosable row: a tool, and for "From clipboard" rows the text and mode it opens with. */
export interface PaletteItem {
  tool: ToolDef;
  clip?: { suggestion: ClipboardSuggestion; text: string };
}

type Row = { kind: "heading"; label: string } | { kind: "item"; item: PaletteItem; index: number; key: string };

/**
 * The visible rows. No query: "From clipboard" (when the clipboard fits a tool), Favorites, Recent, then the rest.
 * With a query: ranked results only.
 */
export function buildRows(
  query: string,
  favoriteIds: string[],
  recentIds: string[],
  settings: Settings,
  clipboard = "",
): { rows: Row[]; items: PaletteItem[] } {
  const pool = tools.filter((t) => isToolSearchable(t, settings));
  const rows: Row[] = [];
  const items: PaletteItem[] = [];
  const add = (label: string, list: PaletteItem[]) => {
    if (list.length === 0) return;
    rows.push({ kind: "heading", label });
    for (const item of list) {
      rows.push({ kind: "item", item, index: items.length, key: `${label}:${item.tool.id}` });
      items.push(item);
    }
  };
  const plain = (list: ToolDef[]) => list.map((tool) => ({ tool }));
  if (query.trim()) {
    add("Tools", plain(searchTools(pool, query)));
  } else {
    if (settings.clipboardSuggestions && clipboard) {
      const clips = detectClipboard(clipboard).flatMap((suggestion) => {
        const tool = pool.find((t) => t.id === suggestion.toolId);
        return tool ? [{ tool, clip: { suggestion, text: clipboard } }] : [];
      });
      add("From clipboard", clips);
    }
    const pick = (ids: string[]) => ids.map((id) => pool.find((t) => t.id === id)).filter((t): t is ToolDef => !!t);
    const favorites = pick(favoriteIds);
    const recent = pick(recentIds).filter((t) => !favorites.includes(t));
    add("Favorites", plain(favorites));
    add("Recent", plain(recent));
    const rest = pool.filter((t) => !favorites.includes(t) && !recent.includes(t));
    add(favorites.length || recent.length ? "All tools" : "Tools", plain(rest));
  }
  return { rows, items };
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Opens a tool; for a clipboard row, with that text (and mode). */
  onChoose: (item: PaletteItem) => void;
}

/** ⌘K inside the main window: the panel over a scrim. */
export function CommandPalette({ open, onClose, onChoose }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-scrim dk-fade-in flex items-start justify-center pt-[14vh] px-4" onMouseDown={onClose}>
      <PalettePanel onClose={onClose} onChoose={onChoose} className="dk-pop-in" />
    </div>
  );
}

/** The search box and list. The ⌘K overlay and the ⌥Space launcher window both render it. */
export function PalettePanel({ onClose, onChoose, className }: Omit<Props, "open"> & { className?: string }) {
  const { favorites, recent } = usePrefs();
  const { settings } = useSettings();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [clipboard, setClipboard] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const { rows, items } = useMemo(
    () => buildRows(q, favorites, recent, settings, clipboard),
    [q, favorites, recent, settings, clipboard],
  );

  // Read the clipboard once per opening, only when suggestions are on.
  useEffect(() => {
    if (!settings.clipboardSuggestions) return;
    let live = true;
    void readClipboardText().then((t) => live && setClipboard(t));
    return () => {
      live = false;
    };
  }, [settings.clipboardSuggestions]);

  useEffect(() => setActive(0), [q, clipboard]);
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  const choose = (item: PaletteItem | undefined) => {
    if (!item) return;
    onChoose(item);
    onClose();
  };
  const optionId = (i: number) => `palette-${i}`;

  return (
    <div
      role="dialog"
      aria-label="Jump to a tool"
      className={cx("w-[36rem] max-w-full rounded-xl bg-surface border border-line shadow-pop overflow-hidden", className)}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-3 px-4 h-[52px] border-b border-line">
        <Search size={18} className="text-fg-faint shrink-0" aria-hidden />
        <input
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls="palette-list"
          aria-activedescendant={items[active] ? optionId(active) : undefined}
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
        {items.length === 0 && <p className="px-3 py-8 text-center text-base text-fg-faint">No tools match “{q.trim()}”</p>}
        {rows.map((r) =>
          r.kind === "heading" ? (
            <div key={`h-${r.label}`} className="px-2.5 pt-2 pb-1 text-xs font-semibold text-fg-faint">
              {r.label}
            </div>
          ) : (
            <div
              key={r.key}
              id={optionId(r.index)}
              role="option"
              aria-selected={r.index === active}
              data-index={r.index}
              data-tool={r.item.tool.id}
              onMouseMove={() => setActive(r.index)}
              onClick={() => choose(r.item)}
              className={cx("flex items-center gap-3 px-2.5 h-11 rounded-lg", r.index === active ? "bg-accent-soft" : "")}
            >
              <IconTile icon={r.item.tool.icon} size={26} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-medium text-fg truncate">{r.item.tool.name}</span>
                  {r.item.tool.online && <OnlineBadge />}
                  {!isToolVisible(r.item.tool, settings) && <Badge>Hidden</Badge>}
                </div>
                <div className="text-sm text-fg-faint truncate">
                  {r.item.clip ? `Open with the ${r.item.clip.suggestion.label} on the clipboard` : r.item.tool.description}
                </div>
              </div>
              {r.item.clip ? (
                <span title="From the clipboard" className="shrink-0 text-fg-faint">
                  <ClipboardPaste size={14} aria-label="From the clipboard" />
                </span>
              ) : (
                <span className="text-sm text-fg-faint shrink-0">{r.item.tool.category}</span>
              )}
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
  );
}
