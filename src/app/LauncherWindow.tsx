import { useCallback, useEffect, useState } from "react";
import { ThemeProvider } from "./theme";
import { SettingsProvider } from "./settings";
import { PrefsProvider } from "./prefs";
import { PalettePanel, type PaletteItem } from "./CommandPalette";
import { LAUNCHER_OPEN, LAUNCHER_SHOW, type LauncherOpen } from "./launcher";
import { inApp } from "./menuEvents";

interface Bridge {
  /** Tell the main window what to open. */
  open: (req: LauncherOpen) => void;
  /** Hide the launcher window. */
  hide: () => void;
  /** Subscribe to "shown again"; returns an unsubscribe. */
  onShow: (cb: () => void) => () => void;
}

/** The real bridge: Tauri events to the main window, hide this window. */
const tauriBridge: Bridge = {
  open: (req) => void import("@tauri-apps/api/event").then(({ emitTo }) => emitTo("main", LAUNCHER_OPEN, req)),
  hide: () => void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => getCurrentWindow().hide()),
  onShow: (cb) => {
    if (!inApp()) return () => {};
    let un: (() => void) | undefined;
    let live = true;
    void import("@tauri-apps/api/event").then(({ listen }) =>
      listen(LAUNCHER_SHOW, cb).then((u) => (live ? (un = u) : u())),
    );
    return () => {
      live = false;
      un?.();
    };
  },
};

/**
 * The ⌥Space window: the ⌘K panel alone on a transparent window. Each time it's shown it remounts, so the query
 * is empty, the clipboard is read again and favorites / settings changed in the main window are current.
 */
export function Launcher({ bridge = tauriBridge }: { bridge?: Bridge }) {
  const [opening, setOpening] = useState(0);
  useEffect(() => bridge.onShow(() => setOpening((n) => n + 1)), [bridge]);

  const choose = useCallback(
    (item: PaletteItem) =>
      bridge.open(
        item.clip ? { toolId: item.tool.id, text: item.clip.text, mode: item.clip.suggestion.mode } : { toolId: item.tool.id },
      ),
    [bridge],
  );

  return (
    <ThemeProvider key={opening}>
      <SettingsProvider>
        <PrefsProvider>
          {/* A click on the transparent part of the window dismisses it too. */}
          <div className="h-full flex items-start justify-center p-4" onMouseDown={bridge.hide}>
            <PalettePanel onClose={bridge.hide} onChoose={choose} />
          </div>
        </PrefsProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
