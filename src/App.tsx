import { useCallback, useEffect, useState } from "react";
import { Search, Star } from "lucide-react";
import { ThemeProvider } from "./app/theme";
import { PrefsProvider, usePrefs } from "./app/prefs";
import { Sidebar } from "./app/Sidebar";
import { CommandPalette } from "./app/CommandPalette";
import { About } from "./app/About";
import { Home } from "./app/Home";
import { useActiveTool } from "./app/useActiveTool";
import { getToolById } from "./tools/registry";
import type { ToolDef } from "./tools/types";
import { Button, cx, IconTile, OnlineBadge } from "./lib/ui";

function ToolHeader({ tool, onSearch }: { tool: ToolDef | undefined; onSearch: () => void }) {
  const { favorites, toggleFavorite } = usePrefs();
  const fav = tool ? favorites.includes(tool.id) : false;
  return (
    <header
      data-tauri-drag-region
      className="h-[52px] shrink-0 flex items-center gap-3 pl-4 pr-3 border-b border-line bg-canvas/80 backdrop-blur"
    >
      {tool ? (
        <>
          <IconTile icon={tool.icon} size={30} />
          <div data-tauri-drag-region className="min-w-0 flex items-baseline gap-2.5">
            <h1 data-tauri-drag-region className="text-md font-semibold text-fg truncate">
              {tool.name}
            </h1>
            <p data-tauri-drag-region className="text-base text-fg-faint truncate hidden min-[900px]:block">
              {tool.description}
            </p>
          </div>
          {tool.online && <OnlineBadge />}
        </>
      ) : (
        <h1 data-tauri-drag-region className="text-md font-semibold text-fg">
          All tools
        </h1>
      )}
      <div data-tauri-drag-region className="flex-1 self-stretch" />
      {tool && (
        <Button
          variant="ghost"
          icon={Star}
          label={fav ? "Remove from favorites (⌘D)" : "Add to favorites (⌘D)"}
          aria-pressed={fav}
          className={cx(fav && "!text-accent [&_svg]:fill-accent")}
          onClick={() => toggleFavorite(tool.id)}
        />
      )}
      <Button variant="ghost" icon={Search} label="Find a tool (⌘K)" onClick={onSearch} />
    </header>
  );
}

function Shell() {
  const { activeId, setActiveId } = useActiveTool();
  const { markUsed, toggleFavorite } = usePrefs();
  const [query, setQuery] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const active = activeId ? getToolById(activeId) : undefined;
  const Active = active?.component;

  const select = useCallback(
    (id: string | null) => {
      setActiveId(id);
      if (id) markUsed(id);
    },
    [setActiveId, markUsed],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (key === "d" && activeId) {
        e.preventDefault();
        toggleFavorite(activeId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, toggleFavorite]);

  return (
    <div className="flex h-screen bg-canvas text-fg">
      <Sidebar
        activeId={active ? active.id : null}
        onSelect={select}
        query={query}
        onQuery={setQuery}
        onAbout={() => setAboutOpen(true)}
      />
      <main className="flex-1 min-w-0 flex flex-col">
        <ToolHeader tool={active} onSearch={() => setPaletteOpen(true)} />
        <div className="flex-1 min-h-0">
          {Active ? <Active key={active.id} /> : <Home onSelect={select} onSearch={() => setPaletteOpen(true)} />}
        </div>
      </main>
      <About open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onSelect={select} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <PrefsProvider>
        <Shell />
      </PrefsProvider>
    </ThemeProvider>
  );
}
