import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { TOOL_ALIASES } from "../tools/registry";

const FAVORITES_KEY = "devkit.favorites";
const RECENT_KEY = "devkit.recent";
export const RECENT_MAX = 6;

/** Adds `id` when missing, removes it when present. */
export function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/** Moves `id` to the front, keeping at most `max` entries. */
export function pushRecent(list: string[], id: string, max = RECENT_MAX): string[] {
  return [id, ...list.filter((x) => x !== id)].slice(0, max);
}

/** Reads a string[] from localStorage; anything else (missing, corrupt) is []. Merged tools map to their new id. */
export function loadIds(key: string): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(v)) return [];
    const ids = v.filter((x): x is string => typeof x === "string").map((id) => TOOL_ALIASES[id] ?? id);
    return [...new Set(ids)];
  } catch {
    return [];
  }
}

function save(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    /* storage full or blocked: the in-memory list still works */
  }
}

interface Prefs {
  favorites: string[];
  toggleFavorite: (id: string) => void;
  recent: string[];
  markUsed: (id: string) => void;
}

const Ctx = createContext<Prefs>({ favorites: [], toggleFavorite: () => {}, recent: [], markUsed: () => {} });

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState(() => loadIds(FAVORITES_KEY));
  const [recent, setRecent] = useState(() => loadIds(RECENT_KEY));

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = toggleId(prev, id);
      save(FAVORITES_KEY, next);
      return next;
    });
  }, []);

  const markUsed = useCallback((id: string) => {
    setRecent((prev) => {
      const next = pushRecent(prev, id);
      save(RECENT_KEY, next);
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ favorites, toggleFavorite, recent, markUsed }}>{children}</Ctx.Provider>;
}

export const usePrefs = () => useContext(Ctx);
