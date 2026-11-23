import { useEffect, useRef, useState } from "react";
import { Globe, LayoutGrid, Search, Settings, Star, X } from "lucide-react";
import { tools, CATEGORY_ORDER } from "../tools/registry";
import type { ToolDef } from "../tools/types";
import { Button, cx, Kbd } from "../lib/ui";
import { ThemeSwitcher } from "./theme";
import { usePrefs } from "./prefs";
import { searchTools } from "./search";
import { openToolMenu } from "./toolMenu";
import { FAVORITE_SHORTCUTS, useCmdHeld, useFavoriteTools } from "./favorites";
import { isToolSearchable, isToolVisible, useSettings } from "./settings";

interface Props {
  activeId: string | null;
  onSelect: (id: string | null) => void;
  query: string;
  onQuery: (q: string) => void;
  onAbout?: () => void;
  onSettings?: () => void;
}

interface ItemProps {
  tool: ToolDef;
  active: boolean;
  onSelect: (id: string) => void;
  /** Set for rows in the Favorites list (enables Move Up / Move Down and ⌥↑ / ⌥↓). */
  favoritesPosition?: { index: number; count: number };
  onMove?: (delta: -1 | 1) => void;
  dragging?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  /** 1…9 when the row has a ⌘-number shortcut; `showShortcut` while ⌘ is held. */
  shortcut?: number;
  showShortcut?: boolean;
}

function Item({ tool, active, onSelect, favoritesPosition, onMove, dragging, onPointerDown, shortcut, showShortcut }: ItemProps) {
  const { favorites, toggleFavorite } = usePrefs();
  const Icon = tool.icon;
  const favorite = favorites.includes(tool.id);
  return (
    <div
      className={cx("group relative", dragging && "opacity-40")}
      onPointerDown={onPointerDown}
      onContextMenu={(e) =>
        openToolMenu(e, { favorite, favoritesPosition }, (action) => {
          if (action === "open") onSelect(tool.id);
          else if (action === "toggle-favorite") toggleFavorite(tool.id);
          else onMove?.(action === "move-up" ? -1 : 1);
        })
      }
    >
      <button
        type="button"
        onClick={() => onSelect(tool.id)}
        onKeyDown={(e) => {
          if (!onMove || !e.altKey || e.metaKey || e.ctrlKey) return;
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            onMove(e.key === "ArrowUp" ? -1 : 1);
          }
        }}
        aria-current={active ? "page" : undefined}
        aria-keyshortcuts={[shortcut && `Meta+${shortcut}`, onMove && "Alt+ArrowUp Alt+ArrowDown"].filter(Boolean).join(" ") || undefined}
        className={cx(
          "w-full h-8 flex items-center gap-2.5 pl-2.5 pr-8 rounded-md text-left text-base transition-colors duration-75",
          "outline-none focus-visible:ring-2 focus-visible:ring-accent-ring",
          active ? "bg-accent-soft text-fg font-medium" : "text-fg-muted hover:bg-surface-3/70 hover:text-fg",
        )}
      >
        <Icon
          size={16}
          strokeWidth={active ? 2.2 : 1.9}
          className={cx("shrink-0", active ? "text-accent-text" : "text-fg-faint group-hover:text-fg-muted")}
          aria-hidden
        />
        <span className="truncate flex-1">{tool.name}</span>
      </button>
      {shortcut !== undefined && showShortcut && (
        <Kbd className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none">⌘{shortcut}</Kbd>
      )}
      {tool.online && !showShortcut && (
        <span title="Uses the network" className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none group-hover:opacity-0">
          <Globe size={12} className="text-info opacity-80" aria-label="Online" />
        </span>
      )}
      {/* Mouse shortcut; keyboard users have ⌘D on the open tool and the context menu. */}
      <button
        type="button"
        tabIndex={-1}
        title={favorite ? "Remove from favorites" : "Add to favorites"}
        aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={favorite}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => toggleFavorite(tool.id)}
        className={cx(
          "absolute right-1 top-1/2 -translate-y-1/2 grid place-items-center w-6 h-6 rounded-sm",
          "opacity-0 group-hover:opacity-100 transition-opacity duration-75",
          showShortcut && shortcut !== undefined && "invisible",
          favorite ? "text-accent" : "text-fg-faint hover:text-fg",
        )}
      >
        <Star size={13} className={favorite ? "fill-accent" : undefined} aria-hidden />
      </button>
    </div>
  );
}

/** Pixels the pointer must travel before a press on a row becomes a drag. */
const DRAG_THRESHOLD = 4;
/** Distance from the list's top / bottom edge where a drag scrolls it, and the speed (px per frame). */
const AUTOSCROLL_EDGE = 36;
const AUTOSCROLL_SPEED = 8;

interface DragState {
  id: string;
  /** Pointer position, for the ghost. */
  x: number;
  y: number;
  /** Insertion index in the Favorites list (0…n), or null while the pointer isn't over it. */
  over: number | null;
}

/**
 * Dragging rows into and within the Favorites list. A favorite dragged inside the list reorders it; any other
 * row dropped on the list (or on the empty drop zone) becomes a favorite at that spot. Pointer events, not HTML5
 * drag and drop (the Tauri webview owns native drops for files).
 */
function useFavoriteDrag(list: ToolDef[], navRef: React.RefObject<HTMLElement | null>) {
  const { favorites, toggleFavorite, moveFavorite } = usePrefs();
  const latest = useRef({ favorites, list });
  latest.current = { favorites, list };
  const zoneRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const pointerY = useRef(0);
  const justDragged = useRef(false);

  /** Insertion index for a pointer at (x, y), or null when it isn't over the Favorites zone (heading included). */
  const overAt = (x: number, y: number): number | null => {
    const zone = zoneRef.current;
    if (!zone) return null;
    const b = zone.getBoundingClientRect();
    if (x < b.left || x > b.right || y < b.top - 24 || y > b.bottom + 12) return null;
    const rows = Array.from(zone.querySelectorAll("[data-fav-row]"));
    return rows.filter((r) => {
      const rb = r.getBoundingClientRect();
      return rb.top + rb.height / 2 < y;
    }).length;
  };

  // Near the top or bottom of the list, keep scrolling while the pointer rests there.
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    let frame = 0;
    const tick = () => {
      const nav = navRef.current;
      if (nav) {
        const b = nav.getBoundingClientRect();
        if (pointerY.current < b.top + AUTOSCROLL_EDGE) nav.scrollTop -= AUTOSCROLL_SPEED;
        else if (pointerY.current > b.bottom - AUTOSCROLL_EDGE) nav.scrollTop += AUTOSCROLL_SPEED;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [dragging, navRef]);

  const start = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    const sx = e.clientX;
    const sy = e.clientY;
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_THRESHOLD) return;
      moved = true;
      pointerY.current = ev.clientY;
      setDrag({ id, x: ev.clientX, y: ev.clientY, over: overAt(ev.clientX, ev.clientY) });
    };
    const finish = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      setDrag(null);
      if (!moved) return;
      // The click that ends a drag must not open the tool.
      justDragged.current = true;
      setTimeout(() => (justDragged.current = false), 0);
      if (ev.type === "pointercancel") return;
      const over = overAt(ev.clientX, ev.clientY);
      if (over === null) return;
      const { favorites: favs, list: rows } = latest.current;
      if (!favs.includes(id)) toggleFavorite(id);
      moveFavorite(id, rows[over]?.id ?? null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  const suppressClick = (e: React.MouseEvent) => {
    if (justDragged.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  return { drag, start, zoneRef, suppressClick };
}

/** The Favorites rows: drag (or ⌥↑ / ⌥↓, or the context menu) to reorder. */
function FavoritesList({
  list,
  activeId,
  onSelect,
  cmdHeld,
  drag,
  onPress,
  zoneRef,
}: {
  list: ToolDef[];
  activeId: string | null;
  onSelect: (id: string) => void;
  cmdHeld: boolean;
  drag: DragState | null;
  onPress: (e: React.PointerEvent, id: string) => void;
  zoneRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { moveFavorite } = usePrefs();
  const move = (index: number, delta: -1 | 1) => {
    const id = list[index].id;
    if (delta === -1 && index > 0) moveFavorite(id, list[index - 1].id);
    if (delta === 1 && index < list.length - 1) moveFavorite(id, list[index + 2]?.id ?? null);
  };
  const over = drag?.over ?? null;
  return (
    <div ref={zoneRef} className="flex flex-col gap-px">
      {list.map((t, i) => (
        <div key={t.id} data-fav-row className="relative">
          {over === i && <DropLine edge="top" />}
          {over === list.length && i === list.length - 1 && <DropLine edge="bottom" />}
          <Item
            tool={t}
            active={t.id === activeId}
            onSelect={onSelect}
            favoritesPosition={{ index: i, count: list.length }}
            onMove={(delta) => move(i, delta)}
            dragging={drag?.id === t.id}
            onPointerDown={(e) => onPress(e, t.id)}
            shortcut={i < FAVORITE_SHORTCUTS ? i + 1 : undefined}
            showShortcut={cmdHeld && !drag}
          />
        </div>
      ))}
    </div>
  );
}

/** Shown in place of the Favorites list while a tool is dragged and there are no favorites yet. */
function EmptyDropZone({ active, zoneRef }: { active: boolean; zoneRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div
      ref={zoneRef}
      className={cx(
        "h-9 mx-0.5 rounded-md border border-dashed grid place-items-center text-sm transition-colors duration-75",
        active ? "border-accent bg-accent-soft text-fg" : "border-line-strong text-fg-faint",
      )}
    >
      Drop to add to Favorites
    </div>
  );
}

/** The row under the pointer while dragging. */
function DragGhost({ tool, x, y }: { tool: ToolDef; x: number; y: number }) {
  const Icon = tool.icon;
  return (
    <div
      aria-hidden
      style={{ transform: `translate(${x + 12}px, ${y + 10}px)` }}
      className="fixed left-0 top-0 z-50 pointer-events-none flex items-center gap-2 h-7 px-2.5 rounded-md bg-surface border border-line shadow-pop text-sm text-fg"
    >
      <Icon size={14} className="text-fg-muted" />
      {tool.name}
    </div>
  );
}

function DropLine({ edge }: { edge: "top" | "bottom" }) {
  return (
    <div
      aria-hidden
      className={cx("absolute left-1.5 right-1.5 h-0.5 rounded-full bg-accent pointer-events-none z-10", edge === "top" ? "-top-px" : "-bottom-px")}
    />
  );
}

function Section({ title, children, raw }: { title: string; children: React.ReactNode; raw?: boolean }) {
  return (
    <div className="mb-4">
      <div className="px-2.5 pb-1 text-xs font-semibold text-fg-faint tracking-[0.02em]">{title}</div>
      {raw ? children : <div className="flex flex-col gap-px">{children}</div>}
    </div>
  );
}

export function Sidebar({ activeId, onSelect, query, onQuery, onAbout, onSettings }: Props) {
  const { settings } = useSettings();
  const visible = tools.filter((t) => isToolVisible(t, settings));
  const favTools = useFavoriteTools();
  const cmdHeld = useCmdHeld();
  const navRef = useRef<HTMLElement>(null);
  const { drag, start, zoneRef, suppressClick } = useFavoriteDrag(favTools, navRef);
  const dragTool = drag ? tools.find((t) => t.id === drag.id) : undefined;
  const searchRef = useRef<HTMLInputElement>(null);
  const searching = query.trim().length > 0;
  // Search reaches hidden tools too; switched-off online tools stay out.
  const results = searching ? searchTools(tools.filter((t) => isToolSearchable(t, settings)), query) : [];

  return (
    <aside className="w-[244px] shrink-0 flex flex-col bg-sidebar border-r border-line">
      {/* Title bar strip: room for the traffic lights, drags the window. */}
      <div data-tauri-drag-region className="h-[52px] shrink-0" />

      <div className="px-3 pb-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-faint pointer-events-none" aria-hidden />
          <input
            ref={searchRef}
            type="search"
            aria-label="Search tools"
            placeholder="Search tools…"
            value={query}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onQuery("");
              if (e.key === "Enter" && results[0]) {
                onSelect(results[0].id);
                onQuery("");
              }
            }}
            className={cx(
              "w-full h-8 rounded-md pl-8 pr-8 text-base bg-surface border border-line text-fg placeholder:text-fg-faint",
              "outline-none focus:border-accent focus:ring-3 focus:ring-accent-ring/60",
              "[&::-webkit-search-cancel-button]:hidden",
            )}
          />
          {searching ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                onQuery("");
                searchRef.current?.focus();
              }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 grid place-items-center w-5 h-5 rounded-full text-fg-faint hover:text-fg hover:bg-surface-3"
            >
              <X size={12} />
            </button>
          ) : (
            <Kbd className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">⌘K</Kbd>
          )}
        </div>
      </div>

      <nav
        ref={navRef}
        aria-label="Tools"
        className={cx(
          "flex-1 overflow-y-auto px-2 pb-2",
          // While dragging, rows don't react to hover (the window listeners still get the pointer).
          drag && "select-none cursor-grabbing [&_button]:pointer-events-none",
        )}
        onClickCapture={suppressClick}
      >
        {searching ? (
          results.length > 0 ? (
            <Section title={`${results.length} ${results.length === 1 ? "result" : "results"}`}>
              {results.map((t) => (
                <Item key={t.id} tool={t} active={t.id === activeId} onSelect={onSelect} />
              ))}
            </Section>
          ) : (
            <p className="px-2.5 py-6 text-base text-fg-faint text-center">No tools match “{query.trim()}”</p>
          )
        ) : (
          <>
            <div className="mb-4">
              <button
                type="button"
                onClick={() => onSelect(null)}
                aria-keyshortcuts="Meta+0"
                aria-current={activeId === null ? "page" : undefined}
                className={cx(
                  "w-full h-8 flex items-center gap-2.5 px-2.5 rounded-md text-base transition-colors duration-75",
                  "outline-none focus-visible:ring-2 focus-visible:ring-accent-ring",
                  activeId === null ? "bg-accent-soft text-fg font-medium" : "text-fg-muted hover:bg-surface-3/70 hover:text-fg",
                )}
              >
                <LayoutGrid size={16} className={activeId === null ? "text-accent-text" : "text-fg-faint"} aria-hidden />
                All tools
                {cmdHeld ? (
                  <Kbd className="ml-auto">⌘0</Kbd>
                ) : (
                  <span className="ml-auto text-sm text-fg-faint tabular-nums">{visible.length}</span>
                )}
              </button>
            </div>
            {favTools.length > 0 ? (
              <Section title="Favorites" raw>
                <FavoritesList
                  list={favTools}
                  activeId={activeId}
                  onSelect={onSelect}
                  cmdHeld={cmdHeld}
                  drag={drag}
                  onPress={start}
                  zoneRef={zoneRef}
                />
              </Section>
            ) : (
              drag && (
                <Section title="Favorites" raw>
                  <EmptyDropZone active={drag.over !== null} zoneRef={zoneRef} />
                </Section>
              )
            )}
            {CATEGORY_ORDER.map((cat) => {
              const items = visible.filter((t) => t.category === cat);
              if (items.length === 0) return null;
              return (
                <Section key={cat} title={cat}>
                  {items.map((t) => (
                    <Item
                      key={t.id}
                      tool={t}
                      active={t.id === activeId}
                      onSelect={onSelect}
                      dragging={drag?.id === t.id}
                      onPointerDown={(e) => start(e, t.id)}
                    />
                  ))}
                </Section>
              );
            })}
          </>
        )}
      </nav>

      <div className="shrink-0 border-t border-line px-3 h-12 flex items-center gap-2">
        <button
          type="button"
          onClick={onAbout}
          className="flex items-center gap-2 min-w-0 rounded-md -ml-1 px-1 py-1 hover:bg-surface-3/70 outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
          title="About DevKit"
          aria-label="About DevKit"
        >
          <img src="/app-icon.png" alt="" width={22} height={22} className="shrink-0" />
          <span className="text-base font-semibold text-fg">DevKit</span>
        </button>
        <div className="flex-1" />
        <ThemeSwitcher />
        <Button variant="ghost" size="sm" icon={Settings} label="Settings (⌘,)" onClick={onSettings} />
      </div>
      {drag && dragTool && <DragGhost tool={dragTool} x={drag.x} y={drag.y} />}
    </aside>
  );
}
