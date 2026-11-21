/**
 * JSON Editor — pure parts: structural diff of two documents (for tree highlighting and
 * difference navigation), reading editor content, and the split-pane geometry.
 */

export type JsonPath = string[];

export const DIFF_CLASS = {
  changed: "jse-diff-changed",
  added: "jse-diff-added",
  removed: "jse-diff-removed",
  parent: "jse-diff-parent",
  current: "jse-diff-current",
} as const;

export interface JsonDiff {
  /** pathKey → class for the left document (removed / changed / parent). */
  left: Map<string, string>;
  /** pathKey → class for the right document (added / changed / parent). */
  right: Map<string, string>;
  /** Every difference in document order; navigation walks this list. */
  list: JsonPath[];
}

/** Stable map key for a path (the editor hands us string segments). */
export const pathKey = (path: readonly (string | number)[]): string => JSON.stringify(path.map(String));

const hasOwn = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * Compares two JSON values. Arrays compare by index, objects by the union of their keys (left
 * key order first). A key/index only on the left is "removed", only on the right "added", a
 * different leaf (or a type change) is "changed" on both sides. Every ancestor of a difference is
 * marked "parent" on both sides so collapsed nodes still show where the changes are.
 */
export function diffJson(a: unknown, b: unknown): JsonDiff {
  const left = new Map<string, string>();
  const right = new Map<string, string>();
  const list: JsonPath[] = [];

  const markParents = (path: JsonPath) => {
    for (let i = 0; i < path.length; i++) {
      const k = pathKey(path.slice(0, i));
      if (!left.has(k)) left.set(k, DIFF_CLASS.parent);
      if (!right.has(k)) right.set(k, DIFF_CLASS.parent);
    }
  };
  const record = (path: JsonPath, l?: string, r?: string) => {
    const k = pathKey(path);
    if (l) left.set(k, l);
    if (r) right.set(k, r);
    markParents(path);
    list.push(path);
  };

  const walk = (x: unknown, y: unknown, path: JsonPath) => {
    if (Array.isArray(x) && Array.isArray(y)) {
      const n = Math.max(x.length, y.length);
      for (let i = 0; i < n; i++) {
        const p = [...path, String(i)];
        if (i >= y.length) record(p, DIFF_CLASS.removed);
        else if (i >= x.length) record(p, undefined, DIFF_CLASS.added);
        else walk(x[i], y[i], p);
      }
      return;
    }
    if (isPlainObject(x) && isPlainObject(y)) {
      const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
      for (const k of keys) {
        const p = [...path, k];
        if (!hasOwn(y, k)) record(p, DIFF_CLASS.removed);
        else if (!hasOwn(x, k)) record(p, undefined, DIFF_CLASS.added);
        else walk(x[k], y[k], p);
      }
      return;
    }
    if (!Object.is(x, y)) record(path, DIFF_CLASS.changed, DIFF_CLASS.changed);
  };

  walk(a, b, []);
  return { left, right, list };
}

/** Class for one node, adding the "current difference" outline. */
export function classFor(map: Map<string, string> | undefined, path: readonly (string | number)[], current: string | null) {
  if (!map) return undefined;
  const k = pathKey(path);
  const cls = map.get(k);
  if (k === current) return cls ? `${cls} ${DIFF_CLASS.current}` : DIFF_CLASS.current;
  return cls;
}

/** Where to scroll a side for a difference: the path itself, or its parent when that side lacks it. */
export function scrollTarget(map: Map<string, string>, path: JsonPath): JsonPath {
  return map.has(pathKey(path)) ? path : path.slice(0, -1);
}

/** Editor content is `{ json }` (tree/table mode) or `{ text }` (text mode). */
export type EditorContent = { json: unknown } | { text: string };

/** The JSON value in an editor's content; throws on invalid text. */
export function contentJson(c: EditorContent): unknown {
  if ("json" in c && c.json !== undefined) return c.json;
  if ("text" in c) return JSON.parse(c.text);
  return undefined;
}

/** Content as pretty text, for saving. */
export function contentText(c: EditorContent): string {
  if ("text" in c && typeof c.text === "string") return c.text;
  return JSON.stringify((c as { json: unknown }).json, null, 2) + "\n";
}

/* ------------------------------------------------------------- split */

/** Within this fraction of an edge, dragging collapses that side. */
export const SNAP = 0.06;
export type SplitState = { kind: "split"; ratio: number } | { kind: "collapsed-left" } | { kind: "collapsed-right" };

/** Interprets a left-pane ratio (0…1) as a split or a collapsed side. */
export function splitFor(ratio: number): SplitState {
  const r = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0.5));
  if (r <= SNAP) return { kind: "collapsed-left" };
  if (r >= 1 - SNAP) return { kind: "collapsed-right" };
  return { kind: "split", ratio: r };
}

/** Left-pane ratio for a pointer at `x` in a container starting at `left`, `width` wide, minus the middle column. */
export function ratioAt(x: number, left: number, width: number, middle: number): number {
  const usable = width - middle;
  if (usable <= 0) return 0.5;
  return Math.min(1, Math.max(0, (x - left - middle / 2) / usable));
}

/* ------------------------------------------------------------ status */

export type CompareStatus =
  | { kind: "off" }
  | { kind: "invalid"; side: "left" | "right" }
  | { kind: "same" }
  | { kind: "diff"; count: number; current: number };

export function statusText(s: CompareStatus): string {
  switch (s.kind) {
    case "off":
      return "";
    case "invalid":
      return `Invalid JSON in the ${s.side === "left" ? "original" : "modified"}`;
    case "same":
      return "No differences";
    case "diff":
      return s.current >= 0
        ? `${s.current + 1} / ${s.count}`
        : `${s.count} ${s.count === 1 ? "difference" : "differences"}`;
  }
}

/** Next index when stepping through `count` differences (wraps around; -1 = none selected yet). */
export function step(current: number, delta: number, count: number): number {
  if (count <= 0) return -1;
  if (current < 0) return delta > 0 ? 0 : count - 1;
  return (((current + delta) % count) + count) % count;
}

/* ------------------------------------------------------------ samples */

export const SAMPLE_LEFT = {
  service: "inventory-api",
  version: "1.4.0",
  replicas: 2,
  regions: ["eu-west", "us-east"],
  database: { engine: "postgres", pool: 10, ssl: true },
  features: { search: true, export: false },
};

export const SAMPLE_RIGHT = {
  service: "inventory-api",
  version: "1.5.0",
  replicas: 3,
  regions: ["eu-west", "us-east", "ap-south"],
  database: { engine: "postgres", pool: 20, ssl: true, timeoutMs: 5000 },
  features: { search: true },
};

/* ------------------------------------------------------------- change list */

export interface Change {
  kind: "changed" | "added" | "removed";
  path: JsonPath;
  /** Value on the left (absent for "added"). */
  before?: unknown;
  /** Value on the right (absent for "removed"). */
  after?: unknown;
}

function at(doc: unknown, path: JsonPath): unknown {
  let v: unknown = doc;
  for (const seg of path) {
    if (v === null || typeof v !== "object") return undefined;
    v = (v as Record<string, unknown>)[seg];
  }
  return v;
}

/** The differences of `d` as a readable list, in document order. */
export function changeList(a: unknown, b: unknown, d: JsonDiff): Change[] {
  return d.list.map((path) => {
    const k = pathKey(path);
    const l = d.left.get(k);
    const r = d.right.get(k);
    if (r === DIFF_CLASS.added) return { kind: "added", path, after: at(b, path) };
    if (l === DIFF_CLASS.removed) return { kind: "removed", path, before: at(a, path) };
    return { kind: "changed", path, before: at(a, path), after: at(b, path) };
  });
}

/** `["items","2","name"]` → `items[2].name`; keys that aren't identifiers get `["…"]`. */
export function formatPath(path: readonly string[]): string {
  if (path.length === 0) return "(root)";
  return path
    .map((seg, i) =>
      /^\d+$/.test(seg) ? `[${seg}]` : /^[A-Za-z_$][\w$]*$/.test(seg) ? (i === 0 ? seg : `.${seg}`) : `[${JSON.stringify(seg)}]`,
    )
    .join("");
}

/** Short one-line preview of a value for the change list. */
export function preview(v: unknown, max = 80): string {
  const s = v === undefined ? "undefined" : JSON.stringify(v);
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
