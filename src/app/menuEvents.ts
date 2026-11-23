import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/** Item ids sent by the native menu (src-tauri/src/menu.rs). */
export type MenuId =
  | "about"
  | "check-updates"
  | "settings"
  | "find-tool"
  | "toggle-sidebar"
  | "whats-new"
  | "report-issue"
  | "shortcuts";

/** True inside the app, where the menu owns ⌘K, ⌘, and ⌃⌘S (so the page must not handle them too). */
export const inApp = (): boolean => {
  try {
    return isTauri();
  } catch {
    return false;
  }
};

/** Calls `handler` for every native menu click. No-op in a plain browser. Returns an unsubscribe. */
export function onMenu(handler: (id: MenuId) => void): () => void {
  if (!inApp()) return () => {};
  let unlisten: (() => void) | null = null;
  let cancelled = false;
  listen<string>("menu", (e) => handler(e.payload as MenuId))
    .then((u) => (cancelled ? u() : (unlisten = u)))
    .catch(() => {});
  return () => {
    cancelled = true;
    unlisten?.();
  };
}
