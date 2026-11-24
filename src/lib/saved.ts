import { createContext, useContext, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ToolIdContext } from "./toolActive";

/**
 * Tool input that survives quitting DevKit: every tool keeps what was typed, picked or toggled in localStorage under
 * `devkit.input.<tool id>.<name>`, written on every change. Settings → General → "Remember tool input" turns it off
 * (and forgets everything saved). Files the user opened (images) are not stored, only the options around them.
 */
export const SAVED_PREFIX = "devkit.input.";

/** Provided by the settings ("Remember tool input"); on unless the user switched it off. */
export const RememberInput = createContext(true);
export const useRememberInput = () => useContext(RememberInput);

export function savedKey(toolId: string, name: string): string {
  return `${SAVED_PREFIX}${toolId}.${name}`;
}

/** Reads a saved value; undefined when nothing (valid) is stored. */
export function readSaved(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : (JSON.parse(raw) as unknown);
  } catch {
    return undefined;
  }
}

/** Stores a value; one too large for localStorage removes the stored copy so a stale one never comes back. */
export function writeSaved(key: string, value: unknown): void {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    try {
      localStorage.removeItem(key);
    } catch {
      /* not remembered */
    }
  }
}

/** Forgets every tool's saved input (the setting switched off). */
export function clearSavedInput(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(SAVED_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* nothing to forget */
  }
}

/** Same kind of value as the default: same typeof, both arrays or both not, null only where the default is null. */
export function sameShape(def: unknown, v: unknown): boolean {
  if (v === undefined) return false;
  if (def === null || v === null) return def === v;
  if (Array.isArray(def) !== Array.isArray(v)) return false;
  return typeof def === typeof v;
}

export interface SavedOptions<T> {
  /** Accepts a stored value; default `sameShape` with the initial value. Use it for enums (modes, units…). */
  valid?: (v: unknown) => boolean;
  /** A value that wins over the saved one, e.g. text handed over by another tool. */
  prefer?: T;
}

/**
 * `useState` whose value is saved for this tool under `name` and comes back on the next launch.
 * Outside a tool (no tool id) or with "Remember tool input" off it is plain `useState`.
 */
export function useSaved<T>(name: string, initial: T | (() => T), opts: SavedOptions<T> = {}): [T, Dispatch<SetStateAction<T>>] {
  const toolId = useContext(ToolIdContext);
  const remember = useRememberInput();
  const key = toolId && remember ? savedKey(toolId, name) : null;
  const [value, setValue] = useState<T>(() => {
    const def = typeof initial === "function" ? (initial as () => T)() : initial;
    if (opts.prefer !== undefined) return opts.prefer;
    if (!key) return def;
    const v = readSaved(key);
    return (opts.valid ? v !== undefined && opts.valid(v) : sameShape(def, v)) ? (v as T) : def;
  });
  const first = useRef(true);
  useEffect(() => {
    // Nothing to write for the value just read, unless it came from `prefer` (a hand-off is new input).
    if (first.current) {
      first.current = false;
      if (opts.prefer === undefined) return;
    }
    if (key) writeSaved(key, value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, value]);
  return [value, setValue];
}
