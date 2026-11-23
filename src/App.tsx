import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, PanelLeft, Search, Settings as SettingsIcon, Star } from "lucide-react";
import { ThemeProvider } from "./app/theme";
import { PrefsProvider, pushRecent, usePrefs } from "./app/prefs";
import { ToolActiveContext, ToolIdContext } from "./lib/toolActive";
import { historyKey, startHistory, step, visit } from "./app/history";
import { isShortcutsKey } from "./app/shortcuts";
import { useLauncher, type LauncherOpen } from "./app/launcher";
import { ShortcutsSheet } from "./app/ShortcutsSheet";
import { cycleFavorite, numberShortcut, tabCycleDirection, useFavoriteTools } from "./app/favorites";
import { Sidebar } from "./app/Sidebar";
import { CommandPalette, type PaletteItem } from "./app/CommandPalette";
import { About, APP } from "./app/About";
import { WhatsNew } from "./app/WhatsNew";
import { Home } from "./app/Home";
import { SettingsView, type PaneId } from "./app/SettingsView";
import { SettingsProvider, toggledSidebar, useSettings } from "./app/settings";
import { UpdaterProvider, useUpdater } from "./app/updater";
import { checkWhatsNew } from "./app/updates";
import { inApp, onMenu, type MenuId } from "./app/menuEvents";
import { useActiveTool } from "./app/useActiveTool";
import { OPEN_TOOL_EVENT, sendTo } from "./app/handoff";
import { getToolById } from "./tools/registry";
import type { ToolDef } from "./tools/types";
import { Button, cx, IconTile, OnlineBadge } from "./lib/ui";
import { openExternal } from "./lib/openExternal";

/** Room on the left of the title bar for the traffic lights + the sidebar button (overlay title bar). */
const CHROME_LEFT = "pl-[188px]";

function ToolHeader({
  tool,
  onSearch,
  onSettings,
  sidebarInFlow,
}: {
  tool: ToolDef | undefined;
  onSearch: () => void;
  onSettings: () => void;
  sidebarInFlow: boolean;
}) {
  const { favorites, toggleFavorite } = usePrefs();
  const fav = tool ? favorites.includes(tool.id) : false;
  return (
    <header
      data-tauri-drag-region
      className={cx(
        "h-[52px] shrink-0 flex items-center gap-3 pr-3 border-b border-line bg-canvas/80 backdrop-blur",
        sidebarInFlow ? "pl-4" : CHROME_LEFT,
      )}
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
      <Button variant="ghost" icon={SettingsIcon} label="Settings (⌘,)" onClick={onSettings} />
    </header>
  );
}

/**
 * Auto-hide: a thin strip on the left edge brings the sidebar in. While it's out, the pointer position decides:
 * more than a little to the right of it (and nothing focused inside) sends it away. Pointer tracking rather than
 * mouseleave, because the panel slides in under a pointer that hasn't moved, so it never gets mouseenter.
 */
function useAutoHide(enabled: boolean) {
  const [revealed, setRevealed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => {
    if (!enabled) setRevealed(false);
  }, [enabled]);
  useEffect(() => {
    if (!revealed) return;
    const onMove = (e: MouseEvent) => {
      const right = panel.current?.getBoundingClientRect().right ?? 0;
      if (e.clientX <= right + 16) return cancel();
      if (timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        if (!panel.current?.contains(document.activeElement)) setRevealed(false);
      }, 280);
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancel();
    };
  }, [revealed]);
  return { revealed, panel, show: () => setRevealed(true), hideNow: () => setRevealed(false) };
}

/** How many recently used tools stay mounted (hidden) so their input survives switching. */
export const KEEP_ALIVE = 6;

/** Recently opened tool ids, newest first, at most KEEP_ALIVE; the open tool is always in it. */
function useKeepAlive(activeId: string | null): string[] {
  const [alive, setAlive] = useState<string[]>(() => (activeId ? [activeId] : []));
  if (activeId && alive[0] !== activeId) {
    // Updated during render (not in an effect) so the open tool is mounted in the same pass.
    const next = pushRecent(alive, activeId, KEEP_ALIVE);
    setAlive(next);
    return next;
  }
  return alive;
}

function Shell() {
  const { activeId, setActiveId } = useActiveTool();
  const { markUsed, toggleFavorite } = usePrefs();
  const favTools = useFavoriteTools();
  const { settings, update } = useSettings();
  const { check } = useUpdater();
  const [query, setQuery] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [settingsPane, setSettingsPane] = useState<PaneId | null>(null);
  const active = activeId ? getToolById(activeId) : undefined;
  const alive = useKeepAlive(active?.id ?? null);
  const mode = settings.sidebar;
  const auto = useAutoHide(mode === "autohide");

  const [history, setHistory] = useState(() => startHistory(activeId));
  const open = useCallback(
    (id: string | null) => {
      setActiveId(id);
      if (id) markUsed(id);
      auto.hideNow();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setActiveId, markUsed],
  );
  const select = useCallback(
    (id: string | null) => {
      setHistory((h) => visit(h, id));
      open(id);
    },
    [open],
  );
  /** ⌘[ / ⌘] and the ‹ › buttons: move through history without adding to it. */
  const go = useCallback(
    (delta: -1 | 1) => {
      const next = step(history, delta);
      if (!next) return;
      setHistory(next);
      setPaletteOpen(false);
      open(next.entries[next.index]);
    },
    [history, open],
  );

  /** A palette row: a clipboard suggestion opens the tool with that text, anything else just opens it. */
  const openItem = useCallback(
    (item: PaletteItem) => {
      if (item.clip) sendTo(item.tool.id, { kind: "text", text: item.clip.text, mode: item.clip.suggestion.mode });
      else select(item.tool.id);
    },
    [select],
  );

  // ⌥Space launcher (another window) asks for a tool: the main window has already come forward.
  const openFromLauncher = useCallback(
    (req: LauncherOpen) => {
      if (!getToolById(req.toolId)) return;
      setPaletteOpen(false);
      if (req.text !== undefined) sendTo(req.toolId, { kind: "text", text: req.text, mode: req.mode });
      else select(req.toolId);
    },
    [select],
  );
  useLauncher(settings.globalShortcut, openFromLauncher);

  const toggleSidebar = useCallback(() => update({ sidebar: toggledSidebar(mode) }), [update, mode]);
  const openSettings = useCallback((pane: PaneId = "general") => setSettingsPane(pane), []);

  // What's New: once per new version, after an update (app-shell's `.automatic`).
  useEffect(() => {
    if (checkWhatsNew(APP.version)) setWhatsNewOpen(true);
  }, []);

  const runMenu = useCallback(
    (id: MenuId) => {
      switch (id) {
        case "about":
          setAboutOpen(true);
          break;
        case "check-updates":
          openSettings("updates");
          void check(true);
          break;
        case "settings":
          openSettings();
          break;
        case "find-tool":
          setPaletteOpen((v) => !v);
          break;
        case "toggle-sidebar":
          toggleSidebar();
          break;
        case "whats-new":
          setWhatsNewOpen(true);
          break;
        case "report-issue":
          void openExternal(APP.newIssueURL);
          break;
        case "shortcuts":
          setShortcutsOpen((v) => !v);
          break;
      }
    },
    [check, openSettings, toggleSidebar],
  );

  useEffect(() => onMenu(runMenu), [runMenu]);

  // Another tool handed over a result: open the target (remounted, so it reads the payload on mount).
  const [handoffs, setHandoffs] = useState<Record<string, number>>({});
  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (!getToolById(id)) return;
      setHandoffs((h) => ({ ...h, [id]: (h[id] ?? 0) + 1 }));
      select(id);
    };
    window.addEventListener(OPEN_TOOL_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_TOOL_EVENT, onOpen);
  }, [select]);

  // Keyboard. In the app the native menu owns ⌘K, ⌘, and ⌃⌘S; in a plain browser the page handles them.
  useEffect(() => {
    const menuOwnsKeys = inApp();
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (e.metaKey && e.ctrlKey && key === "s") {
        if (!menuOwnsKeys) {
          e.preventDefault();
          toggleSidebar();
        }
        return;
      }
      // ⌘0 = All tools, ⌘1…⌘9 = favorites in sidebar order.
      const digit = numberShortcut(e);
      if (digit !== null) {
        const target = digit === 0 ? null : favTools[digit - 1]?.id;
        if (target !== undefined) {
          e.preventDefault();
          setPaletteOpen(false);
          select(target);
        }
        return;
      }
      if (isShortcutsKey(e)) {
        // In the app the Help menu's ⌘/ owns it; in a browser, unless an editor used it (CodeMirror comments).
        if (!menuOwnsKeys && !e.defaultPrevented) {
          e.preventDefault();
          setShortcutsOpen((v) => !v);
        }
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.altKey) return;
      if (key === "k" && !menuOwnsKeys) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (key === "," && !menuOwnsKeys) {
        e.preventDefault();
        openSettings();
      } else if (key === "d" && activeId) {
        e.preventDefault();
        toggleFavorite(activeId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, toggleFavorite, toggleSidebar, openSettings, favTools, select]);

  // Navigation keys, in the capture phase so an editor can't take them first (tools focus their editor on open,
  // and CodeMirror would indent on ⌘[ / ⌘]; Tab / Shift+Tab still indent there).
  // ⌘[ / ⌘] = back / forward; Ctrl+Tab / Ctrl+Shift+Tab cycle the favorites like browser tabs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const back = historyKey(e);
      if (back !== null) {
        e.preventDefault();
        e.stopPropagation();
        go(back);
        return;
      }
      const dir = tabCycleDirection(e);
      if (dir === null) return;
      const next = cycleFavorite(
        favTools.map((t) => t.id),
        activeId,
        dir,
      );
      if (next === null) return;
      e.preventDefault();
      e.stopPropagation();
      setPaletteOpen(false);
      select(next);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [favTools, activeId, select, go]);

  const sidebar = (
    <Sidebar
      activeId={active ? active.id : null}
      onSelect={select}
      query={query}
      onQuery={setQuery}
      onAbout={() => setAboutOpen(true)}
      onSettings={() => openSettings()}
    />
  );

  return (
    <div className="relative flex h-screen bg-canvas text-fg">
      {mode === "shown" && sidebar}

      {mode === "autohide" && (
        <>
          <div aria-hidden className="fixed left-0 top-[52px] bottom-0 w-2 z-30" onMouseEnter={auto.show} />
          <div
            ref={auto.panel}
            className={cx(
              "fixed left-0 top-0 bottom-0 z-40 flex shadow-pop transition-transform duration-200 ease-[var(--ease-snappy)]",
              auto.revealed ? "translate-x-0" : "-translate-x-full",
            )}
            inert={!auto.revealed}
          >
            {sidebar}
          </div>
        </>
      )}

      {/* Sit right of the traffic lights in every mode, like Finder or Safari. */}
      <div className="fixed top-[12px] left-[80px] z-[45] flex items-center">
        <Button
          variant="ghost"
          icon={PanelLeft}
          label={mode === "shown" ? "Hide sidebar (⌃⌘S)" : "Show sidebar (⌃⌘S)"}
          onClick={toggleSidebar}
          onMouseEnter={mode === "autohide" ? auto.show : undefined}
        />
        <Button variant="ghost" icon={ChevronLeft} label="Back (⌘[)" disabled={history.index === 0} onClick={() => go(-1)} />
        <Button
          variant="ghost"
          icon={ChevronRight}
          label="Forward (⌘])"
          disabled={history.index === history.entries.length - 1}
          onClick={() => go(1)}
        />
      </div>

      <main className="flex-1 min-w-0 flex flex-col">
        <ToolHeader
          tool={active}
          onSearch={() => setPaletteOpen(true)}
          onSettings={() => openSettings()}
          sidebarInFlow={mode === "shown"}
        />
        <div className="flex-1 min-h-0">
          {alive.map((id) => {
            const tool = getToolById(id);
            if (!tool) return null;
            const Tool = tool.component;
            const on = id === active?.id;
            return (
              <div key={`${id}:${handoffs[id] ?? 0}`} className="h-full" hidden={!on} inert={!on}>
                <ToolIdContext.Provider value={id}>
                  <ToolActiveContext.Provider value={on}>
                    <Tool />
                  </ToolActiveContext.Provider>
                </ToolIdContext.Provider>
              </div>
            );
          })}
          {!active && <Home onSelect={select} onSearch={() => setPaletteOpen(true)} />}
        </div>
      </main>

      <About open={aboutOpen} onClose={() => setAboutOpen(false)} onWhatsNew={() => setWhatsNewOpen(true)} />
      <WhatsNew open={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />
      <SettingsView
        open={settingsPane !== null}
        pane={settingsPane ?? "general"}
        onPane={setSettingsPane}
        onClose={() => setSettingsPane(null)}
        onWhatsNew={() => setWhatsNewOpen(true)}
      />
      <ShortcutsSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onChoose={openItem} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <UpdaterProvider>
          <PrefsProvider>
            <Shell />
          </PrefsProvider>
        </UpdaterProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
