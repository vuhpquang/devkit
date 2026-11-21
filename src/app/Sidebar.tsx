import { useRef } from "react";
import { Globe, LayoutGrid, Search, Settings, X } from "lucide-react";
import { tools, CATEGORY_ORDER } from "../tools/registry";
import type { ToolDef } from "../tools/types";
import { Button, cx, Kbd } from "../lib/ui";
import { ThemeSwitcher } from "./theme";
import { usePrefs } from "./prefs";
import { searchTools } from "./search";
import { isToolSearchable, isToolVisible, useSettings } from "./settings";

interface Props {
  activeId: string | null;
  onSelect: (id: string | null) => void;
  query: string;
  onQuery: (q: string) => void;
  onAbout?: () => void;
  onSettings?: () => void;
}

function Item({ tool, active, onSelect }: { tool: ToolDef; active: boolean; onSelect: (id: string) => void }) {
  const Icon = tool.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(tool.id)}
      aria-current={active ? "page" : undefined}
      className={cx(
        "group w-full h-8 flex items-center gap-2.5 px-2.5 rounded-md text-left text-base transition-colors duration-75",
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
      {tool.online && (
        <span title="Uses the network" className="shrink-0">
          <Globe size={12} className="text-info opacity-80" aria-label="Online" />
        </span>
      )}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="px-2.5 pb-1 text-xs font-semibold text-fg-faint tracking-[0.02em]">{title}</div>
      <div className="flex flex-col gap-px">{children}</div>
    </div>
  );
}

export function Sidebar({ activeId, onSelect, query, onQuery, onAbout, onSettings }: Props) {
  const { favorites } = usePrefs();
  const { settings } = useSettings();
  const visible = tools.filter((t) => isToolVisible(t, settings));
  const searchRef = useRef<HTMLInputElement>(null);
  const searching = query.trim().length > 0;
  // Search reaches hidden tools too; switched-off online tools stay out.
  const results = searching ? searchTools(tools.filter((t) => isToolSearchable(t, settings)), query) : [];
  const favTools = favorites.map((id) => visible.find((t) => t.id === id)).filter((t): t is ToolDef => !!t);

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

      <nav aria-label="Tools" className="flex-1 overflow-y-auto px-2 pb-2">
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
                aria-current={activeId === null ? "page" : undefined}
                className={cx(
                  "w-full h-8 flex items-center gap-2.5 px-2.5 rounded-md text-base transition-colors duration-75",
                  "outline-none focus-visible:ring-2 focus-visible:ring-accent-ring",
                  activeId === null ? "bg-accent-soft text-fg font-medium" : "text-fg-muted hover:bg-surface-3/70 hover:text-fg",
                )}
              >
                <LayoutGrid size={16} className={activeId === null ? "text-accent-text" : "text-fg-faint"} aria-hidden />
                All tools
                <span className="ml-auto text-sm text-fg-faint tabular-nums">{visible.length}</span>
              </button>
            </div>
            {favTools.length > 0 && (
              <Section title="Favorites">
                {favTools.map((t) => (
                  <Item key={t.id} tool={t} active={t.id === activeId} onSelect={onSelect} />
                ))}
              </Section>
            )}
            {CATEGORY_ORDER.map((cat) => {
              const items = visible.filter((t) => t.category === cat);
              if (items.length === 0) return null;
              return (
                <Section key={cat} title={cat}>
                  {items.map((t) => (
                    <Item key={t.id} tool={t} active={t.id === activeId} onSelect={onSelect} />
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
    </aside>
  );
}
