/** Back / forward through the tools you opened, like a browser (⌘[ / ⌘]). `null` = the All tools home. */
export interface NavHistory {
  entries: (string | null)[];
  index: number;
}

export const HISTORY_MAX = 50;

export const startHistory = (id: string | null): NavHistory => ({ entries: [id], index: 0 });

/** Opening `id` drops anything ahead of the current entry; opening the current one changes nothing. */
export function visit(h: NavHistory, id: string | null, max = HISTORY_MAX): NavHistory {
  if (h.entries[h.index] === id) return h;
  const entries = [...h.entries.slice(0, h.index + 1), id].slice(-max);
  return { entries, index: entries.length - 1 };
}

/** One step back (-1) or forward (1); null when there's nowhere to go. */
export function step(h: NavHistory, delta: -1 | 1): NavHistory | null {
  const index = h.index + delta;
  return index >= 0 && index < h.entries.length ? { ...h, index } : null;
}

/** ⌘[ = -1, ⌘] = 1 (by physical key), otherwise null. */
export function historyKey(e: Pick<KeyboardEvent, "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">): -1 | 1 | null {
  if (!e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return null;
  return e.code === "BracketLeft" ? -1 : e.code === "BracketRight" ? 1 : null;
}
