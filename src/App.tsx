import { useEffect, useState } from "react";
import { ThemeProvider, useTheme } from "./app/theme";
import { Sidebar } from "./app/Sidebar";
import { CommandPalette } from "./app/CommandPalette";
import { useActiveTool } from "./app/useActiveTool";
import { getToolById } from "./tools/registry";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      className="px-2 py-1 text-sm rounded-md border border-zinc-300 dark:border-zinc-700"
      onClick={() => setTheme(next)}
    >
      {theme === "dark" ? "🌙" : "☀️"}
    </button>
  );
}

function Shell() {
  const { activeId, setActiveId } = useActiveTool();
  const [query, setQuery] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const active = activeId ? getToolById(activeId) : undefined;
  const Active = active?.component;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-screen text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-950">
      <Sidebar activeId={activeId} onSelect={setActiveId} query={query} onQuery={setQuery} />
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center justify-between p-2 border-b border-zinc-200 dark:border-zinc-800">
          <span className="text-xs text-zinc-400 pl-2">Press ⌘K / Ctrl+K to search</span>
          <ThemeToggle />
        </div>
        <div className="flex-1 min-h-0">
          {Active ? (
            <Active />
          ) : (
            <div className="h-full grid place-items-center text-zinc-400">
              Select a tool to begin
            </div>
          )}
        </div>
      </main>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={setActiveId}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Shell />
    </ThemeProvider>
  );
}
