import { Search, Star, WifiOff } from "lucide-react";
import { tools, CATEGORY_ORDER } from "../tools/registry";
import type { ToolDef } from "../tools/types";
import { Button, cx, IconTile, Kbd, OnlineBadge } from "../lib/ui";
import { usePrefs } from "./prefs";
import { openToolMenu } from "./toolMenu";
import { FAVORITE_SHORTCUTS, useCmdHeld, useFavoriteTools } from "./favorites";
import { isToolVisible, useSettings } from "./settings";

function ToolCard({ tool, onSelect, shortcut }: { tool: ToolDef; onSelect: (id: string) => void; shortcut?: number }) {
  const { favorites, toggleFavorite } = usePrefs();
  const favorite = favorites.includes(tool.id);
  return (
    <div
      className="group relative"
      onContextMenu={(e) =>
        openToolMenu(e, { favorite }, (action) => {
          if (action === "open") onSelect(tool.id);
          else if (action === "toggle-favorite") toggleFavorite(tool.id);
        })
      }
    >
      <button
        type="button"
        onClick={() => onSelect(tool.id)}
        className="w-full h-full text-left flex gap-3 p-3.5 pr-9 rounded-xl bg-surface border border-line transition-[border-color,box-shadow,transform] duration-150 group-hover:border-accent/50 group-hover:shadow-[0_4px_16px_rgb(0_0_0/0.07)] group-hover:-translate-y-px active:translate-y-0 outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
      >
        <IconTile icon={tool.icon} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-md font-semibold text-fg truncate">{tool.name}</span>
            {tool.online && <OnlineBadge />}
          </div>
          <p className="text-sm text-fg-muted mt-0.5 line-clamp-2">{tool.description}</p>
        </div>
      </button>
      {shortcut !== undefined && (
        <Kbd className="absolute top-3 right-3 pointer-events-none">⌘{shortcut}</Kbd>
      )}
      {/* Mouse shortcut; keyboard users have ⌘D on the open tool and the context menu. */}
      <button
        type="button"
        tabIndex={-1}
        title={favorite ? "Remove from favorites" : "Add to favorites"}
        aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={favorite}
        onClick={() => toggleFavorite(tool.id)}
        className={cx(
          "absolute top-2.5 right-2.5 grid place-items-center w-6 h-6 rounded-sm transition-[opacity,transform] duration-150 group-hover:-translate-y-px",
          shortcut !== undefined && "invisible",
          favorite ? "text-accent" : "text-fg-faint hover:text-fg opacity-0 group-hover:opacity-100",
        )}
      >
        <Star size={14} className={favorite ? "fill-accent" : undefined} aria-hidden />
      </button>
    </div>
  );
}

function Grid({ title, list, onSelect, shortcuts }: { title: string; list: ToolDef[]; onSelect: (id: string) => void; shortcuts?: boolean }) {
  if (list.length === 0) return null;
  return (
    <section className="mb-7">
      <h2 className="text-sm font-semibold text-fg-muted mb-2.5 flex items-center gap-2">
        {title}
        <span className="text-fg-faint font-normal tabular-nums">{list.length}</span>
      </h2>
      <div className="grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(15.5rem,1fr))]">
        {list.map((t, i) => (
          <ToolCard key={t.id} tool={t} onSelect={onSelect} shortcut={shortcuts && i < FAVORITE_SHORTCUTS ? i + 1 : undefined} />
        ))}
      </div>
    </section>
  );
}

export function Home({ onSelect, onSearch }: { onSelect: (id: string) => void; onSearch: () => void }) {
  const { settings } = useSettings();
  const visible = tools.filter((t) => isToolVisible(t, settings));
  const favTools = useFavoriteTools();
  const cmdHeld = useCmdHeld();
  const local = visible.filter((t) => !t.online).length;
  const hiddenCount = tools.length - visible.length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 pt-6 pb-10">
        <div className="flex items-center gap-4 mb-8">
          <img src="/app-icon.png" alt="" width={60} height={60} className="drop-shadow-md shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-fg">DevKit</h1>
            <p className="text-base text-fg-muted flex items-center gap-1.5 flex-wrap">
              {visible.length} developer tools
              <span className="text-fg-faint">·</span>
              <WifiOff size={13} className="text-fg-faint" aria-hidden />
              {local} work offline
              {hiddenCount > 0 && (
                <>
                  <span className="text-fg-faint">·</span>
                  <span className="text-fg-faint">{hiddenCount} hidden in Settings</span>
                </>
              )}
            </p>
          </div>
          <Button icon={Search} onClick={onSearch} kbd="⌘K">
            Find a tool
          </Button>
        </div>

        <Grid title="Favorites" list={favTools} onSelect={onSelect} shortcuts={cmdHeld} />
        {favTools.length === 0 && (
          <p className="mb-7 -mt-2 text-sm text-fg-faint flex items-center gap-1.5">
            <Star size={13} aria-hidden /> Click the star on a tool (or press <Kbd>⌘D</Kbd> in it) to pin it here and in the sidebar.
          </p>
        )}
        {CATEGORY_ORDER.map((cat) => (
          <Grid key={cat} title={cat} list={visible.filter((t) => t.category === cat)} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
