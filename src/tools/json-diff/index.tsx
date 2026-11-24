import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileText,
  FolderOpen,
  GitCompareArrows,
  ListTree,
  Save,
} from "lucide-react";
import type { OnClassName } from "vanilla-jsoneditor";
import type { ToolDef } from "../types";
import { Badge, Button, Notice, Switch, ToolBar, ToolPage, cx } from "../../lib/ui";
import { JsonEditorView, Mode, type EditorOptions, type JsonEditorHandle } from "../../lib/jsoneditor/JsonEditorView";
import { openJsonFile, saveJsonFile } from "../../lib/jsoneditor/files";
import {
  SAMPLE_LEFT,
  SAMPLE_RIGHT,
  changeList,
  classFor,
  contentJson,
  contentText,
  diffJson,
  formatPath,
  pathKey,
  preview,
  ratioAt,
  scrollTarget,
  splitFor,
  statusText,
  step,
  type Change,
  type CompareStatus,
  type EditorContent,
  type JsonDiff,
} from "../../lib/jsoneditor/diff";
import { takeHandoff } from "../../app/handoff";

type Side = "left" | "right";

const SPLIT_KEY = "devkit.jsonEditor.split";
const DOCS_KEY = "devkit.jsonDiff.docs";
const MIDDLE = 132;
/** Differences are highlighted in tree mode, so both editors start there (the menu switches any time). */
const OPTIONS: EditorOptions = { mode: Mode.tree };

interface Docs {
  left: EditorContent;
  right: EditorContent;
  names: Record<Side, string | null>;
}

const EMPTY: Docs = { left: { json: {} }, right: { json: {} }, names: { left: null, right: null } };

/** Both documents, as last saved in this session (fallback when localStorage can't hold them). */
let memory: Docs = EMPTY;

function isContent(v: unknown): v is EditorContent {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.text === "string" || "json" in o;
}

const nameOf = (v: unknown) => (typeof v === "string" ? v : null);

/** What both sides held the last time anything was typed, opened or copied, across app restarts. */
export function loadDocs(): Docs {
  try {
    const raw = localStorage.getItem(DOCS_KEY);
    if (!raw) return memory;
    const v = JSON.parse(raw) as Partial<Docs> & { names?: Partial<Record<Side, unknown>> };
    return {
      left: isContent(v.left) ? v.left : EMPTY.left,
      right: isContent(v.right) ? v.right : EMPTY.right,
      names: { left: nameOf(v.names?.left), right: nameOf(v.names?.right) },
    };
  } catch {
    return memory;
  }
}

/** Saves both sides. A document too large for localStorage drops the stored copy so a stale one never wins. */
export function saveDocs(docs: Docs) {
  memory = docs;
  try {
    localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
  } catch {
    try {
      localStorage.removeItem(DOCS_KEY);
    } catch {
      /* not remembered */
    }
  }
}

function loadRatio(): number {
  try {
    const v = parseFloat(localStorage.getItem(SPLIT_KEY) ?? "");
    return Number.isFinite(v) ? v : 0.5;
  } catch {
    return 0.5;
  }
}

function Pane({
  side,
  fileName,
  hidden,
  style,
  editorRef,
  initial,
  onChange,
  onClassName,
  onOpen,
  onSave,
}: {
  side: Side;
  fileName: string | null;
  hidden?: boolean;
  style?: React.CSSProperties;
  editorRef: React.Ref<JsonEditorHandle>;
  initial: EditorContent;
  onChange: (content: EditorContent) => void;
  onClassName?: OnClassName;
  onOpen: () => void;
  onSave: () => void;
}) {
  const title = side === "left" ? "Original" : "Modified";
  return (
    <section
      data-side={side}
      style={style}
      className={cx(
        "flex flex-col min-h-0 min-w-0 rounded-lg border border-line bg-surface overflow-hidden shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
        hidden && "hidden",
      )}
    >
      <header className="flex items-center gap-2 h-9 pl-3 pr-1.5 border-b border-line bg-surface-2/70 shrink-0">
        <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-[0.04em]">{title}</h2>
        {fileName && (
          <span className="text-sm text-fg-faint truncate" title={fileName}>
            {fileName}
          </span>
        )}
        <div className="flex-1" />
        <Button variant="ghost" size="sm" icon={FolderOpen} label="Open…" onClick={onOpen} />
        <Button variant="ghost" size="sm" icon={Save} label="Save…" onClick={onSave} />
      </header>
      <div className="flex-1 min-h-0">
        <JsonEditorView ref={editorRef} initial={initial} options={OPTIONS} onChange={onChange} onClassName={onClassName} ariaLabel={`${title} JSON`} />
      </div>
    </section>
  );
}

function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cx("inline-block w-3 h-3 rounded-[3px] border border-line-strong", className)} aria-hidden />
      {label}
    </span>
  );
}

const KIND: Record<Change["kind"], { text: string; tone: "accent" | "success" | "danger" }> = {
  changed: { text: "Changed", tone: "accent" },
  added: { text: "Added", tone: "success" },
  removed: { text: "Removed", tone: "danger" },
};

function JsonDiff() {
  const [error, setError] = useState<string | null>(null);
  // Saved documents load once; a document handed over by JSON Format becomes the original.
  const initial = useRef<Docs | null>(null);
  const handedOver = useRef(false);
  if (!initial.current) {
    const docs = loadDocs();
    const h = takeHandoff("json-diff");
    if (h?.kind === "text") {
      initial.current = { ...docs, left: { text: h.text }, names: { ...docs.names, left: null } };
      handedOver.current = true;
    } else initial.current = docs;
  }
  const [names, setNames] = useState<Record<Side, string | null>>(initial.current.names);
  const namesRef = useRef(names);
  namesRef.current = names;
  const left = useRef<JsonEditorHandle>(null);
  const right = useRef<JsonEditorHandle>(null);
  const editors: Record<Side, React.RefObject<JsonEditorHandle | null>> = { left, right };

  // Every edit, open, copy, swap and sample is saved at once, both sides, so nothing typed is lost.
  const persist = useCallback((nextNames?: Record<Side, string | null>, edited?: { side: Side; content: EditorContent }) => {
    if (!left.current || !right.current) return;
    const doc = (side: Side) => (edited?.side === side ? edited.content : (side === "left" ? left : right).current!.get());
    saveDocs({ left: doc("left"), right: doc("right"), names: nextNames ?? namesRef.current });
  }, []);
  const onEdit = (side: Side) => (content: EditorContent) => {
    persist(undefined, { side, content });
    scheduleCompare();
  };
  const setNamesAndSave = (next: Record<Side, string | null>) => {
    namesRef.current = next;
    setNames(next);
    persist(next);
  };

  useEffect(() => {
    if (handedOver.current) persist();
    return () => persist();
  }, [persist]);

  // ---- compare state
  const [compareOn, setCompareOn] = useState(true);
  const [diff, setDiff] = useState<JsonDiff | null>(null);
  const [changes, setChanges] = useState<Change[]>([]);
  const [status, setStatus] = useState<CompareStatus>({ kind: "off" });
  const [current, setCurrent] = useState(-1);
  const [listOpen, setListOpen] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const compareNow = useCallback(() => {
    if (!compareOn || !left.current || !right.current) {
      setDiff(null);
      setChanges([]);
      setStatus({ kind: "off" });
      setCurrent(-1);
      return;
    }
    let a: unknown;
    let b: unknown;
    try {
      a = contentJson(left.current.get());
    } catch {
      setDiff(null);
      setChanges([]);
      setStatus({ kind: "invalid", side: "left" });
      return;
    }
    try {
      b = contentJson(right.current.get());
    } catch {
      setDiff(null);
      setChanges([]);
      setStatus({ kind: "invalid", side: "right" });
      return;
    }
    const d = diffJson(a, b);
    setDiff(d);
    setChanges(changeList(a, b, d));
    setCurrent(-1);
    setStatus(d.list.length ? { kind: "diff", count: d.list.length, current: -1 } : { kind: "same" });
  }, [compareOn]);

  const scheduleCompare = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(compareNow, 150);
  }, [compareNow]);

  useEffect(() => {
    compareNow();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [compareNow]);

  const currentKey = diff && current >= 0 ? pathKey(diff.list[current]) : null;
  const leftClass = useMemo<OnClassName | undefined>(() => (diff ? (path) => classFor(diff.left, path, currentKey) : undefined), [diff, currentKey]);
  const rightClass = useMemo<OnClassName | undefined>(() => (diff ? (path) => classFor(diff.right, path, currentKey) : undefined), [diff, currentKey]);

  const goTo = (index: number) => {
    if (!diff || index < 0 || index >= diff.list.length) return;
    setCurrent(index);
    setStatus({ kind: "diff", count: diff.list.length, current: index });
    const path = diff.list[index];
    void left.current?.scrollTo(scrollTarget(diff.left, path)).catch(() => {});
    void right.current?.scrollTo(scrollTarget(diff.right, path)).catch(() => {});
  };
  const go = (delta: number) => diff && diff.list.length && goTo(step(current, delta, diff.list.length));

  /** After the editors were changed from code (copy, swap, open, sample), which fires no onChange. */
  const changed = () => {
    persist();
    scheduleCompare();
  };

  const copy = (from: Side, to: Side) => {
    const c = editors[from].current?.get();
    if (c) editors[to].current?.set(c);
    changed();
  };
  const swap = () => {
    const a = left.current?.get();
    const b = right.current?.get();
    if (a && b) {
      left.current?.set(b);
      right.current?.set(a);
      namesRef.current = { left: namesRef.current.right, right: namesRef.current.left };
      setNames(namesRef.current);
    }
    changed();
  };

  // ---- files
  const openInto = (side: Side) => async () => {
    try {
      setError(null);
      const file = await openJsonFile();
      if (!file) return;
      editors[side].current?.set({ text: file.text });
      namesRef.current = { ...namesRef.current, [side]: file.name };
      setNames(namesRef.current);
      changed();
    } catch (e) {
      setError(`Couldn't open the file: ${(e as Error).message ?? e}`);
    }
  };
  const saveFrom = (side: Side) => async () => {
    try {
      setError(null);
      const c = editors[side].current?.get();
      if (!c) return;
      const saved = await saveJsonFile(names[side] ?? (side === "left" ? "original.json" : "modified.json"), contentText(c));
      if (saved) setNamesAndSave({ ...namesRef.current, [side]: saved });
    } catch (e) {
      setError(`Couldn't save the file: ${(e as Error).message ?? e}`);
    }
  };

  const loadSample = () => {
    left.current?.set({ json: SAMPLE_LEFT });
    right.current?.set({ json: SAMPLE_RIGHT });
    namesRef.current = { left: null, right: null };
    setNames(namesRef.current);
    changed();
  };

  // ---- split
  const [ratio, setRatio] = useState(loadRatio);
  const mainRef = useRef<HTMLDivElement>(null);
  const split = splitFor(ratio);
  const applyRatio = (r: number) => {
    setRatio(r);
    try {
      localStorage.setItem(SPLIT_KEY, String(r));
    } catch {
      /* not remembered */
    }
  };

  const onMiddleDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button, label, [role=switch]")) return;
    const el = e.currentTarget;
    const startX = e.clientX;
    let moved = false;
    el.setPointerCapture?.(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      if (!moved && Math.abs(ev.clientX - startX) < 3) return;
      moved = true;
      document.body.classList.add("dk-col-resizing");
      const rect = mainRef.current!.getBoundingClientRect();
      applyRatio(ratioAt(ev.clientX, rect.left, rect.width, MIDDLE));
    };
    const onUp = () => {
      document.body.classList.remove("dk-col-resizing");
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  };

  const collapsed = split.kind !== "split";
  const leftStyle: React.CSSProperties = split.kind === "split" ? { flex: `0 0 calc((100% - ${MIDDLE}px) * ${split.ratio})` } : { flex: "1 1 0" };
  const statusTone = status.kind === "invalid" ? "text-danger" : status.kind === "same" ? "text-success" : status.kind === "diff" ? "text-accent-text" : "";
  const counts = changes.reduce((m, c) => ({ ...m, [c.kind]: (m[c.kind] ?? 0) + 1 }), {} as Partial<Record<Change["kind"], number>>);

  return (
    <ToolPage>
      <ToolBar
        end={
          <Button size="sm" variant="ghost" icon={FileText} onClick={loadSample}>
            Sample
          </Button>
        }
      >
        <Button icon={ArrowLeftRight} onClick={swap}>
          Swap sides
        </Button>
        {status.kind === "diff" && (
          <span className="flex items-center gap-1.5 ml-1">
            {counts.changed ? <Badge tone="accent">{counts.changed} changed</Badge> : null}
            {counts.added ? <Badge tone="success">{counts.added} added</Badge> : null}
            {counts.removed ? <Badge tone="danger">{counts.removed} removed</Badge> : null}
          </span>
        )}
        <span className="text-sm text-fg-faint">Differences are highlighted in tree mode</span>
      </ToolBar>
      {error && <Notice>{error}</Notice>}

      <div ref={mainRef} className="flex-1 min-h-0 flex">
        <Pane
          side="left"
          fileName={names.left}
          hidden={split.kind === "collapsed-left"}
          style={leftStyle}
          editorRef={left}
          initial={initial.current.left}
          onChange={onEdit("left")}
          onClassName={leftClass}
          onOpen={openInto("left")}
          onSave={saveFrom("left")}
        />
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Drag to resize"
          title="Drag to resize"
          onPointerDown={onMiddleDown}
          className={cx(
            "relative shrink-0 flex flex-col items-center select-none touch-none cursor-col-resize text-sm",
            collapsed ? "w-7 justify-center" : "pt-10 gap-1.5 px-2",
          )}
          style={collapsed ? undefined : { width: MIDDLE }}
        >
          {collapsed ? (
            <Button variant="ghost" size="sm" icon={split.kind === "collapsed-left" ? ChevronRight : ChevronLeft} label="Show both panels" onClick={() => applyRatio(0.5)} />
          ) : (
            <>
              <span className="text-xs font-semibold text-fg-faint">Copy</span>
              <div className="flex gap-1">
                <Button size="sm" icon={ChevronLeft} label="Copy modified to original" onClick={() => copy("right", "left")} />
                <Button size="sm" icon={ChevronRight} label="Copy original to modified" onClick={() => copy("left", "right")} />
              </div>
              <span className="text-xs font-semibold text-fg-faint mt-4">Differences</span>
              <label className="flex items-center gap-2 text-fg-muted">
                <Switch label="Compare" checked={compareOn} onChange={setCompareOn} />
                Compare
              </label>
              <p role="status" className={cx("text-center tabular-nums min-h-[2.5em] mt-1", statusTone)}>
                {statusText(status)}
              </p>
              {status.kind === "diff" && (
                <div className="flex gap-1">
                  <Button size="sm" icon={ArrowUp} label="Previous difference" onClick={() => go(-1)} />
                  <Button size="sm" icon={ArrowDown} label="Next difference" onClick={() => go(1)} />
                </div>
              )}
              <div className="mt-5 flex flex-col gap-1.5 text-xs text-fg-faint self-stretch pl-1">
                <Swatch className="bg-accent-soft !border-accent/60" label="changed" />
                <Swatch className="bg-diff-add-strong" label="only modified" />
                <Swatch className="bg-diff-del-strong" label="only original" />
                <Swatch className="bg-accent" label="contains a difference" />
              </div>
              <span className="mt-auto mb-3 text-fg-faint text-lg leading-none" aria-hidden>
                ⋮
              </span>
            </>
          )}
        </div>
        <Pane
          side="right"
          fileName={names.right}
          hidden={split.kind === "collapsed-right"}
          style={{ flex: "1 1 0" }}
          editorRef={right}
          initial={initial.current.right}
          onChange={onEdit("right")}
          onClassName={rightClass}
          onOpen={openInto("right")}
          onSave={saveFrom("right")}
        />
      </div>

      {changes.length > 0 && (
        <section className="shrink-0 rounded-lg border border-line bg-surface overflow-hidden">
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            aria-expanded={listOpen}
            className="w-full flex items-center gap-2 h-9 px-3 bg-surface-2/70 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
          >
            <ListTree size={14} className="text-fg-faint" aria-hidden />
            <span className="text-sm font-semibold text-fg-muted uppercase tracking-[0.04em]">Changes</span>
            <span className="text-sm text-fg-faint tabular-nums">{changes.length}</span>
            <span className="flex-1" />
            {listOpen ? <ChevronDown size={14} className="text-fg-faint" /> : <ChevronUp size={14} className="text-fg-faint" />}
          </button>
          {listOpen && (
            <ul className="max-h-48 overflow-y-auto divide-y divide-line border-t border-line">
              {changes.map((c, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={i === current ? "true" : undefined}
                    className={cx(
                      "w-full flex items-center gap-3 px-3 py-1.5 text-left hover:bg-surface-2 outline-none focus-visible:bg-surface-2",
                      i === current && "bg-accent-soft",
                    )}
                  >
                    <Badge tone={KIND[c.kind].tone} className="w-[68px] justify-center">
                      {KIND[c.kind].text}
                    </Badge>
                    <code className="font-mono text-[12.5px] text-fg font-medium shrink-0 max-w-[40%] truncate">{formatPath(c.path)}</code>
                    <span className="font-mono text-[12.5px] min-w-0 truncate">
                      {c.kind !== "added" && <span className="text-danger line-through decoration-danger/50">{preview(c.before)}</span>}
                      {c.kind === "changed" && <span className="text-fg-faint mx-1.5">→</span>}
                      {c.kind !== "removed" && <span className="text-success">{preview(c.after)}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "json-diff",
  name: "JSON Diff",
  category: "Diff",
  description: "Compare two JSON documents side by side, jump between differences",
  icon: GitCompareArrows,
  keywords: ["json", "diff", "compare", "changes", "difference", "merge", "tree"],
  component: JsonDiff,
};
