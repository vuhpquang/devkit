import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { ToolDef } from "../tools/types";
import { EditorDefaults } from "../lib/ui/CodeEditor";

/** How the sidebar behaves: always there, collapsed, or sliding in when the pointer reaches the left edge. */
export type SidebarMode = "shown" | "hidden" | "autohide";
export type Startup = "last" | "home";

export interface Settings {
  sidebar: SidebarMode;
  startup: Startup;
  /** Tool ids hidden from the sidebar and the home grid (⌘K still finds them). */
  hiddenTools: string[];
  /** Off = every online tool is hidden, ⌘K included: a fully offline DevKit. */
  showOnlineTools: boolean;
  editorFontSize: number;
  wrapLines: boolean;
  lineNumbers: boolean;
  autoCheckUpdates: boolean;
  /** ⌘K and the launcher suggest tools for what's on the clipboard. Off = the clipboard is never read. */
  clipboardSuggestions: boolean;
  /** ⌥Space opens the launcher from any app. */
  globalShortcut: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  sidebar: "shown",
  startup: "last",
  hiddenTools: [],
  showOnlineTools: true,
  editorFontSize: 13,
  wrapLines: false,
  lineNumbers: true,
  autoCheckUpdates: true,
  clipboardSuggestions: true,
  globalShortcut: true,
};

export const FONT_SIZES = [11, 12, 13, 14, 15, 16, 18] as const;
const KEY = "devkit.settings";

/** Reads stored settings; unknown or invalid fields fall back to the defaults, extra fields are dropped. */
export function parseSettings(raw: string | null): Settings {
  let v: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(raw ?? "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) v = parsed as Record<string, unknown>;
  } catch {
    /* corrupt → defaults */
  }
  const d = DEFAULT_SETTINGS;
  const oneOf = <T extends string>(x: unknown, list: readonly T[], def: T): T =>
    typeof x === "string" && (list as readonly string[]).includes(x) ? (x as T) : def;
  const bool = (x: unknown, def: boolean) => (typeof x === "boolean" ? x : def);
  return {
    sidebar: oneOf(v.sidebar, ["shown", "hidden", "autohide"], d.sidebar),
    startup: oneOf(v.startup, ["last", "home"], d.startup),
    hiddenTools: Array.isArray(v.hiddenTools) ? v.hiddenTools.filter((x): x is string => typeof x === "string") : d.hiddenTools,
    showOnlineTools: bool(v.showOnlineTools, d.showOnlineTools),
    editorFontSize:
      typeof v.editorFontSize === "number" && (FONT_SIZES as readonly number[]).includes(v.editorFontSize)
        ? v.editorFontSize
        : d.editorFontSize,
    wrapLines: bool(v.wrapLines, d.wrapLines),
    lineNumbers: bool(v.lineNumbers, d.lineNumbers),
    autoCheckUpdates: bool(v.autoCheckUpdates, d.autoCheckUpdates),
    clipboardSuggestions: bool(v.clipboardSuggestions, d.clipboardSuggestions),
    globalShortcut: bool(v.globalShortcut, d.globalShortcut),
  };
}

/** Whether a tool appears in the sidebar and on the home grid. */
export function isToolVisible(tool: ToolDef, s: Settings): boolean {
  if (tool.online && !s.showOnlineTools) return false;
  return !s.hiddenTools.includes(tool.id);
}

/** Whether ⌘K offers a tool: hidden tools stay findable, switched-off online tools don't. */
export function isToolSearchable(tool: ToolDef, s: Settings): boolean {
  return !(tool.online && !s.showOnlineTools);
}

/** Toggle button / ⌃⌘S: a visible sidebar collapses, a collapsed or auto-hiding one gets pinned. */
export function toggledSidebar(mode: SidebarMode): SidebarMode {
  return mode === "shown" ? "hidden" : "shown";
}

interface Ctx {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

const SettingsCtx = createContext<Ctx>({ settings: DEFAULT_SETTINGS, update: () => {}, reset: () => {} });

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => parseSettings(localStorage.getItem(KEY)));

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* storage blocked: settings still apply for this session */
    }
    document.documentElement.style.setProperty("--editor-font-size", `${settings.editorFontSize}px`);
  }, [settings]);

  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);
  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), []);

  return (
    <SettingsCtx.Provider value={{ settings, update, reset }}>
      <EditorDefaults.Provider value={{ wrap: settings.wrapLines, lineNumbers: settings.lineNumbers }}>{children}</EditorDefaults.Provider>
    </SettingsCtx.Provider>
  );
}

export const useSettings = () => useContext(SettingsCtx);

/** Startup tool: the last one when the setting says so, otherwise the home grid. */
export function initialToolId(stored: string | null): string | null {
  return parseSettings(localStorage.getItem(KEY)).startup === "home" ? null : stored;
}
