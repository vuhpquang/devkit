import { useEffect, useSyncExternalStore } from "react";
import { inApp } from "./menuEvents";

/** The global shortcut that toggles the launcher (Tauri accelerator syntax). Shown as ⌥Space. */
export const LAUNCHER_SHORTCUT = "Alt+Space";

/** Events between the windows. */
export const LAUNCHER_SHOW = "launcher:show";
export const LAUNCHER_OPEN = "launcher:open";

/** What the launcher asks the main window to open. */
export interface LauncherOpen {
  toolId: string;
  /** Set for a clipboard suggestion: the text (and TransformTool mode) to open the tool with. */
  text?: string;
  mode?: string;
}

/* ------------------------------------------------ Shortcut status (Settings shows it) */

export type ShortcutStatus =
  | { kind: "off" }
  | { kind: "on" }
  | { kind: "browser" }
  | { kind: "error"; message: string };

let status: ShortcutStatus = { kind: inApp() ? "off" : "browser" };
const listeners = new Set<() => void>();
function setStatus(s: ShortcutStatus) {
  status = s;
  listeners.forEach((l) => l());
}

/** Whether ⌥Space is registered, and why not when it isn't. */
export function useShortcutStatus(): ShortcutStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

/** Shows the launcher (centred, focused, reset) or hides it when it's already up. */
export async function toggleLauncher() {
  const { Window } = await import("@tauri-apps/api/window");
  const { emitTo } = await import("@tauri-apps/api/event");
  const w = await Window.getByLabel("launcher");
  if (!w) return;
  if (await w.isVisible()) {
    await w.hide();
    return;
  }
  await emitTo("launcher", LAUNCHER_SHOW);
  await w.center();
  await w.show();
  await w.setFocus();
}

/**
 * Main window only: registers ⌥Space while `enabled`, and runs `onOpen` when the launcher picks a tool
 * (after bringing the main window forward). No-op in a plain browser.
 */
export function useLauncher(enabled: boolean, onOpen: (req: LauncherOpen) => void) {
  useEffect(() => {
    if (!inApp()) return;
    let live = true;
    let unlisten: (() => void) | undefined;
    void (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const u = await listen<LauncherOpen>(LAUNCHER_OPEN, async (e) => {
        const me = getCurrentWindow();
        await me.show();
        await me.unminimize();
        await me.setFocus();
        onOpen(e.payload);
      });
      if (live) unlisten = u;
      else u();
    })().catch(() => {});
    return () => {
      live = false;
      unlisten?.();
    };
  }, [onOpen]);

  useEffect(() => {
    if (!inApp()) return;
    let live = true;
    void (async () => {
      const gs = await import("@tauri-apps/plugin-global-shortcut");
      // A reload (or a second registration from an earlier run of this effect) must not fail on our own shortcut.
      await gs.unregister(LAUNCHER_SHORTCUT).catch(() => {});
      if (!enabled) {
        setStatus({ kind: "off" });
        return;
      }
      try {
        await gs.register(LAUNCHER_SHORTCUT, (e) => {
          if (e.state === "Pressed") void toggleLauncher();
        });
        if (live) setStatus({ kind: "on" });
      } catch (err) {
        setStatus({ kind: "error", message: String((err as Error)?.message ?? err) });
      }
    })();
    return () => {
      live = false;
      void import("@tauri-apps/plugin-global-shortcut").then((gs) => gs.unregister(LAUNCHER_SHORTCUT)).catch(() => {});
    };
  }, [enabled]);
}
