import { useEffect, useMemo, useState } from "react";
import { tools } from "../tools/registry";
import type { ToolDef } from "../tools/types";
import { usePrefs } from "./prefs";
import { isToolVisible, useSettings } from "./settings";

/** ⌘1 … ⌘9 open the first nine favorites. */
export const FAVORITE_SHORTCUTS = 9;

/** Favorites in the user's order, without tools hidden in Settings. The sidebar, Home and ⌘1…⌘9 share it. */
export function useFavoriteTools(): ToolDef[] {
  const { favorites } = usePrefs();
  const { settings } = useSettings();
  return useMemo(() => {
    const visible = tools.filter((t) => isToolVisible(t, settings));
    return favorites.map((id) => visible.find((t) => t.id === id)).filter((t): t is ToolDef => !!t);
  }, [favorites, settings]);
}

type KeyLike = Pick<KeyboardEvent, "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "code">;

/** 0-based favorite index for ⌘1…⌘9 (by physical key, so it works on any layout), otherwise null. */
export function favoriteShortcutIndex(e: KeyLike): number | null {
  if (!e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return null;
  const m = /^Digit([1-9])$/.exec(e.code);
  return m ? Number(m[1]) - 1 : null;
}

/** How long ⌘ must be held alone before the numbers show. 0 = at once: the owner wants them the moment ⌘ goes down (2026-11-23). */
export const CMD_HOLD_MS = 0;

/** True while ⌘ is held down (after `delay`). Another chord hides it, except ⌘1…⌘9. */
export function useCmdHeld(delay = CMD_HOLD_MS): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reset = () => {
      clearTimeout(timer);
      timer = undefined;
      setHeld(false);
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.key === "Meta") {
        if (e.ctrlKey || e.altKey || e.shiftKey) return reset();
        if (delay <= 0) setHeld(true);
        else if (timer === undefined) timer = setTimeout(() => setHeld(true), delay);
      } else if (favoriteShortcutIndex(e) === null) {
        reset();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === "Meta") reset();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", reset);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", reset);
    };
  }, [delay]);
  return held;
}
