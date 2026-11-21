import { Search, Star, WifiOff } from "lucide-react";
import { tools, CATEGORY_ORDER } from "../tools/registry";
import type { ToolDef } from "../tools/types";
import { Button, IconTile, Kbd, OnlineBadge } from "../lib/ui";
import { usePrefs } from "./prefs";

function ToolCard({ tool, onSelect }: { tool: ToolDef; onSelect: (id: string) => void }) {
  const { favorites } = usePrefs();
  return (
    <button
      type="button"
      onClick={() => onSelect(tool.id)}
      className="group text-left flex gap-3 p-3.5 rounded-xl bg-surface border border-line transition-[border-color,box-shadow,transform] duration-150 hover:border-accent/50 hover:shadow-[0_4px_16px_rgb(0_0_0/0.07)] hover:-translate-y-px active:translate-y-0 outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
    >
      <IconTile icon={tool.icon} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-md font-semibold text-fg truncate">{tool.name}</span>
          {favorites.includes(tool.id) && <Star size={12} className="text-accent fill-accent shrink-0" aria-label="Favorite" />}
          {tool.online && <OnlineBadge />}
        </div>
        <p className="text-sm text-fg-muted mt-0.5 line-clamp-2">{tool.description}</p>
      </div>
    </button>
  );
}

function Grid({ title, list, onSelect }: { title: string; list: ToolDef[]; onSelect: (id: string) => void }) {
  if (list.length === 0) return null;
  return (
    <section className="mb-7">
      <h2 className="text-sm font-semibold text-fg-muted mb-2.5 flex items-center gap-2">
        {title}
        <span className="text-fg-faint font-normal tabular-nums">{list.length}</span>
      </h2>
      <div className="grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(15.5rem,1fr))]">
        {list.map((t) => (
          <ToolCard key={t.id} tool={t} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}

export function Home({ onSelect, onSearch }: { onSelect: (id: string) => void; onSearch: () => void }) {
  const { favorites } = usePrefs();
  const favTools = favorites.map((id) => tools.find((t) => t.id === id)).filter((t): t is ToolDef => !!t);
  const local = tools.filter((t) => !t.online).length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 pt-6 pb-10">
        <div className="flex items-center gap-4 mb-8">
          <img src="/app-icon.png" alt="" width={60} height={60} className="drop-shadow-md shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-fg">DevKit</h1>
            <p className="text-base text-fg-muted flex items-center gap-1.5 flex-wrap">
              {tools.length} developer tools
              <span className="text-fg-faint">·</span>
              <WifiOff size={13} className="text-fg-faint" aria-hidden />
              {local} work offline
            </p>
          </div>
          <Button icon={Search} onClick={onSearch} kbd="⌘K">
            Find a tool
          </Button>
        </div>

        <Grid title="Favorites" list={favTools} onSelect={onSelect} />
        {favTools.length === 0 && (
          <p className="mb-7 -mt-2 text-sm text-fg-faint flex items-center gap-1.5">
            <Star size={13} aria-hidden /> Open a tool and press the star (or <Kbd>⌘D</Kbd>) to pin it here and in the sidebar.
          </p>
        )}
        {CATEGORY_ORDER.map((cat) => (
          <Grid key={cat} title={cat} list={tools.filter((t) => t.category === cat)} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
