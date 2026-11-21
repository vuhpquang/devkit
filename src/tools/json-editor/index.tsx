import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, FileText, FolderOpen, PencilRuler, Save } from "lucide-react";
import type { OnClassName } from "vanilla-jsoneditor";
import type { ToolDef } from "../types";
import { Button, Notice, Segmented, Switch, ToolBar, ToolPage, cx } from "../../lib/ui";
import { JsonEditorView, type JsonEditorHandle } from "./JsonEditorView";
import { openJsonFile, saveJsonFile } from "./files";
import {
  SAMPLE_LEFT,
  SAMPLE_RIGHT,
  classFor,
  contentJson,
  contentText,
  diffJson,
  pathKey,
  ratioAt,
  scrollTarget,
  splitFor,
  statusText,
  step,
  type CompareStatus,
  type EditorContent,
  type JsonDiff,
} from "./logic";

type Layout = "edit" | "compare";
type Side = "left" | "right";

const SPLIT_KEY = "devkit.jsonEditor.split";
const MIDDLE = 132;

function loadRatio(): number {
  try {
    const v = parseFloat(localStorage.getItem(SPLIT_KEY) ?? "");
    return Number.isFinite(v) ? v : 0.5;
  } catch {
    return 0.5;
  }
}

/** One editor with its header: title, file name, Open… and Save…. */
function EditorPane({
  side,
  title,
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
  title: string;
  fileName: string | null;
  hidden?: boolean;
  style?: React.CSSProperties;
  editorRef: React.Ref<JsonEditorHandle>;
  initial: EditorContent;
  onChange: () => void;
  onClassName?: OnClassName;
  onOpen: () => void;
  onSave: () => void;
}) {
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
        <JsonEditorView ref={editorRef} initial={initial} onChange={onChange} onClassName={onClassName} ariaLabel={`${title} JSON`} />
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

function JsonEditorTool() {
  const [layout, setLayout] = useState<Layout>("edit");
  const [error, setError] = useState<string | null>(null);
  const [names, setNames] = useState<Record<Side, string | null>>({ left: null, right: null });
  const left = useRef<JsonEditorHandle>(null);
  const right = useRef<JsonEditorHandle>(null);
  const editors: Record<Side, React.RefObject<JsonEditorHandle | null>> = { left, right };
  /** Right document survives switching back to Edit (its editor unmounts there). */
  const rightContent = useRef<EditorContent>({ json: {} });

  // ---- compare state
  const [compareOn, setCompareOn] = useState(true);
  const [diff, setDiff] = useState<JsonDiff | null>(null);
  const [status, setStatus] = useState<CompareStatus>({ kind: "off" });
  const [current, setCurrent] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const compareNow = useCallback(() => {
    if (layout !== "compare" || !compareOn || !left.current || !right.current) {
      setDiff(null);
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
      setStatus({ kind: "invalid", side: "left" });
      return;
    }
    try {
      b = contentJson(right.current.get());
    } catch {
      setDiff(null);
      setStatus({ kind: "invalid", side: "right" });
      return;
    }
    const d = diffJson(a, b);
    setDiff(d);
    setCurrent(-1);
    setStatus(d.list.length ? { kind: "diff", count: d.list.length, current: -1 } : { kind: "same" });
  }, [layout, compareOn]);

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
  const leftClass = useMemo<OnClassName | undefined>(
    () => (diff ? (path) => classFor(diff.left, path, currentKey) : undefined),
    [diff, currentKey],
  );
  const rightClass = useMemo<OnClassName | undefined>(
    () => (diff ? (path) => classFor(diff.right, path, currentKey) : undefined),
    [diff, currentKey],
  );

  const go = (delta: number) => {
    if (!diff || diff.list.length === 0) return;
    const next = step(current, delta, diff.list.length);
    setCurrent(next);
    setStatus({ kind: "diff", count: diff.list.length, current: next });
    const path = diff.list[next];
    void left.current?.scrollTo(scrollTarget(diff.left, path)).catch(() => {});
    void right.current?.scrollTo(scrollTarget(diff.right, path)).catch(() => {});
  };

  const copy = (from: Side, to: Side) => {
    const c = editors[from].current?.get();
    if (c) editors[to].current?.set(c);
    scheduleCompare();
  };

  // ---- files
  const openInto = (side: Side) => async () => {
    try {
      setError(null);
      const file = await openJsonFile();
      if (!file) return;
      editors[side].current?.set({ text: file.text });
      setNames((n) => ({ ...n, [side]: file.name }));
      scheduleCompare();
    } catch (e) {
      setError(`Couldn't open the file: ${(e as Error).message ?? e}`);
    }
  };
  const saveFrom = (side: Side) => async () => {
    try {
      setError(null);
      const c = editors[side].current?.get();
      if (!c) return;
      const saved = await saveJsonFile(names[side] ?? (side === "left" ? "document.json" : "right.json"), contentText(c));
      if (saved) setNames((n) => ({ ...n, [side]: saved }));
    } catch (e) {
      setError(`Couldn't save the file: ${(e as Error).message ?? e}`);
    }
  };

  const loadSample = () => {
    left.current?.set({ json: SAMPLE_LEFT });
    right.current?.set({ json: SAMPLE_RIGHT });
    setNames({ left: null, right: null });
    scheduleCompare();
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

  const compare = layout === "compare";
  const collapsed = compare && split.kind !== "split";
  const leftStyle: React.CSSProperties | undefined = !compare
    ? { flex: "1 1 0" }
    : split.kind === "split"
      ? { flex: `0 0 calc((100% - ${MIDDLE}px) * ${split.ratio})` }
      : { flex: "1 1 0" };

  const statusTone =
    status.kind === "invalid" ? "text-danger" : status.kind === "same" ? "text-success" : status.kind === "diff" ? "text-accent-text" : "";

  return (
    <ToolPage>
      <ToolBar
        end={
          compare && (
            <Button size="sm" variant="ghost" icon={FileText} onClick={loadSample}>
              Sample
            </Button>
          )
        }
      >
        <Segmented<Layout>
          label="Layout"
          value={layout}
          onChange={(l) => {
            if (l === "edit" && right.current) rightContent.current = right.current.get();
            setLayout(l);
          }}
          options={[
            { value: "edit", label: "Edit" },
            { value: "compare", label: "Compare" },
          ]}
        />
        <span className="text-sm text-fg-faint">
          {compare ? "Differences are highlighted in tree mode" : "Tree, text or table — switch in the editor's menu"}
        </span>
      </ToolBar>
      {error && <Notice>{error}</Notice>}
      <div ref={mainRef} className={cx("flex-1 min-h-0 flex", compare ? "gap-0" : "")}>
        <EditorPane
          side="left"
          title={compare ? "Left" : "Document"}
          fileName={names.left}
          hidden={compare && split.kind === "collapsed-left"}
          style={leftStyle}
          editorRef={left}
          initial={{ json: {} }}
          onChange={scheduleCompare}
          onClassName={compare ? leftClass : undefined}
          onOpen={openInto("left")}
          onSave={saveFrom("left")}
        />
        {compare && (
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
              <Button
                variant="ghost"
                size="sm"
                icon={split.kind === "collapsed-left" ? ChevronRight : ChevronLeft}
                label="Show both panels"
                onClick={() => applyRatio(0.5)}
              />
            ) : (
              <>
                <span className="text-xs font-semibold text-fg-faint">Copy</span>
                <div className="flex gap-1">
                  <Button size="sm" icon={ChevronLeft} label="Copy right to left" onClick={() => copy("right", "left")} />
                  <Button size="sm" icon={ChevronRight} label="Copy left to right" onClick={() => copy("left", "right")} />
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
                  <Swatch className="bg-diff-add-strong" label="only right" />
                  <Swatch className="bg-diff-del-strong" label="only left" />
                  <Swatch className="bg-accent" label="contains a difference" />
                </div>
                <span className="mt-auto mb-3 text-fg-faint text-lg leading-none" aria-hidden>
                  ⋮
                </span>
              </>
            )}
          </div>
        )}
        {compare && (
          <EditorPane
            side="right"
            title="Right"
            fileName={names.right}
            hidden={split.kind === "collapsed-right"}
            style={{ flex: "1 1 0" }}
            editorRef={right}
            initial={rightContent.current}
            onChange={scheduleCompare}
            onClassName={rightClass}
            onOpen={openInto("right")}
            onSave={saveFrom("right")}
          />
        )}
      </div>
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "json-editor",
  name: "JSON Editor",
  category: "Formatters",
  description: "Edit JSON as a tree, text or table, and compare two documents",
  icon: PencilRuler,
  keywords: ["json", "editor", "tree", "table", "compare", "diff", "edit", "viewer"],
  component: JsonEditorTool,
};
