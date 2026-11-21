import { useCallback, useRef, useEffect, useMemo, useState } from "react";
import { ArrowRight, CircleAlert, CircleCheck, FolderDown, ImagePlus, Save, Scaling, Trash2, X } from "lucide-react";
import type { ToolDef } from "../types";
import { Badge, Button, EmptyState, Field, Notice, Panel, Segmented, Spinner, TextInput, Toggle, ToolBar, ToolPage, cx } from "../../lib/ui";
import { convertImage, formatBytes, imageInfo, type Converted, type Fit, type ImageInfo } from "../../lib/image";
import { takeHandoff } from "../../app/handoff";
import { CHECKER, pickImages, saveAll, saveFile, useBlobUrl, useImageInput, type ImageFile } from "../image-converter/files";
import { deltaPercent } from "../image-converter/logic";
import {
  DEFAULT_STATE,
  fromHandoff,
  isSafeSuffix,
  mimeOf,
  outFormat,
  outputName,
  PRESETS,
  resizeOptions,
  runPool,
  targetSize,
  type FormatChoice,
  type Mode,
  type ResizeState,
} from "./logic";

const TOOL_ID = "image-resize";

type Status = "pending" | "working" | "done" | "error";

interface Row {
  id: number;
  file: ImageFile;
  info: ImageInfo | null;
  status: Status;
  error?: string;
  out?: Converted & { name: string; mime: string };
}

let nextId = 1;

function Thumb({ file }: { file: ImageFile }) {
  const url = useBlobUrl(file.bytes, file.mime);
  return (
    <span className="w-11 h-11 shrink-0 rounded-md border border-line overflow-hidden grid place-items-center" style={CHECKER}>
      {url && <img src={url} alt="" className="max-w-full max-h-full object-contain" draggable={false} />}
    </span>
  );
}

function ImageResize() {
  const [rows, setRows] = useState<Row[]>([]);
  const [state, setState] = useState<ResizeState>(DEFAULT_STATE);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const set = (patch: Partial<ResizeState>) => setState((s) => ({ ...s, ...patch }));
  const opts = useMemo(() => resizeOptions(state), [state]);
  const suffixOk = isSafeSuffix(state.suffix);

  const add = useCallback(async (files: ImageFile[]) => {
    const fresh: Row[] = files.map((file) => ({ id: nextId++, file, info: null, status: "pending" }));
    setRows((rs) => [...rs, ...fresh]);
    setNotice(null);
    for (const r of fresh) {
      try {
        const info = await imageInfo(r.file.bytes);
        setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, info } : x)));
      } catch (e) {
        setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, status: "error", error: (e as Error).message } : x)));
      }
    }
  }, []);

  // Images handed over by another tool; applied once even when React runs mount effects twice (StrictMode).
  const handedOver = useRef(false);
  useEffect(() => {
    if (handedOver.current) return;
    handedOver.current = true;
    const files = fromHandoff(takeHandoff(TOOL_ID));
    if (files.length) void add(files);
  }, [add]);

  // Changing the options makes earlier results stale.
  useEffect(() => {
    setRows((rs) => rs.map((r) => (r.status === "done" ? { ...r, status: "pending", out: undefined } : r)));
  }, [state]);

  const { dragging, dropProps } = useImageInput((files) => void add(files), setError);

  const preview = (r: Row) => (r.info && opts ? targetSize(r.info.width, r.info.height, opts, r.info.format !== "svg") : null);

  const resizeAll = async () => {
    if (!opts) return;
    setRunning(true);
    setError(null);
    setNotice(null);
    const todo = rows.filter((r) => r.status !== "done" && r.info);
    await runPool(todo, 2, async (r) => {
      setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, status: "working", error: undefined } : x)));
      const format = outFormat(state.format, r.file.name, r.file.mime);
      try {
        const out = await convertImage(r.file.bytes, {
          format,
          ...(format === "jpeg" || format === "webp" ? { quality: state.quality } : {}),
          resize: opts,
        });
        const name = outputName(r.file.name, state.suffix, out.width, out.height, format);
        setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, status: "done", out: { ...out, name, mime: mimeOf(format) } } : x)));
      } catch (e) {
        setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, status: "error", error: (e as Error).message } : x)));
      }
    });
    setRunning(false);
  };

  const done = rows.filter((r) => r.status === "done" && r.out);
  const working = rows.filter((r) => r.status === "working").length;

  const saveEverything = async () => {
    try {
      const where = await saveAll(done.map((r) => ({ name: r.out!.name, mime: r.out!.mime, bytes: r.out!.bytes })));
      if (where) setNotice(where === "download" ? `Downloaded ${done.length} images` : `Saved ${done.length} images to ${where}`);
    } catch (e) {
      setError(`Couldn't save: ${(e as Error).message ?? e}`);
    }
  };

  const saveOne = async (r: Row) => {
    try {
      await saveFile({ name: r.out!.name, mime: r.out!.mime, bytes: r.out!.bytes });
    } catch (e) {
      setError(`Couldn't save: ${(e as Error).message ?? e}`);
    }
  };

  const open = async () => {
    try {
      const files = await pickImages(true);
      if (files.length) await add(files);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <ToolPage scroll>
      <Panel title="Resize" icon={Scaling} className="shrink-0" bodyClassName="p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Segmented<Mode>
            label="Resize by"
            size="sm"
            value={state.mode}
            onChange={(mode) => set({ mode })}
            options={[
              { value: "width", label: "Width" },
              { value: "height", label: "Height" },
              { value: "box", label: "Width × Height" },
              { value: "percent", label: "Percent" },
            ]}
          />
          {(state.mode === "width" || state.mode === "box") && (
            <TextInput aria-label="Width" inputMode="numeric" value={state.width} onChange={(e) => set({ width: e.target.value })} className="w-24 text-right tabular-nums" />
          )}
          {state.mode === "box" && <span className="text-fg-faint">×</span>}
          {(state.mode === "height" || state.mode === "box") && (
            <TextInput aria-label="Height" inputMode="numeric" value={state.height} onChange={(e) => set({ height: e.target.value })} className="w-24 text-right tabular-nums" />
          )}
          {state.mode === "percent" ? (
            <>
              <TextInput aria-label="Percent" inputMode="decimal" value={state.percent} onChange={(e) => set({ percent: e.target.value })} className="w-20 text-right tabular-nums" />
              <span className="text-sm text-fg-faint">%</span>
            </>
          ) : (
            <span className="text-sm text-fg-faint">px</span>
          )}
          {state.mode === "box" && (
            <Segmented<Fit>
              label="Fit"
              size="sm"
              value={state.fit}
              onChange={(fit) => set({ fit })}
              options={[
                { value: "fit", label: "Fit inside", hint: "Keep the aspect, fit inside the box" },
                { value: "fill", label: "Fill & crop", hint: "Keep the aspect, cover the box, crop the rest" },
                { value: "exact", label: "Stretch", hint: "Exactly this size; may distort" },
              ]}
            />
          )}
          <Toggle size="sm" on={state.allowUpscale} onToggle={() => set({ allowUpscale: !state.allowUpscale })} title="Off: images smaller than the target keep their size">
            Allow enlarging
          </Toggle>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm text-fg-faint mr-1">Presets</span>
          {PRESETS.map((p) => (
            <Button key={p.label} size="sm" onClick={() => set(p.patch)}>
              {p.label}
            </Button>
          ))}
        </div>
        <div className="flex items-end gap-4 flex-wrap">
          <Field label="Save as">
            <Segmented<FormatChoice>
              label="Save as"
              size="sm"
              value={state.format}
              onChange={(format) => set({ format })}
              options={[
                { value: "same", label: "Same as source" },
                { value: "png", label: "PNG" },
                { value: "jpeg", label: "JPEG" },
                { value: "webp", label: "WebP" },
              ]}
            />
          </Field>
          {(state.format === "jpeg" || state.format === "webp" || state.format === "same") && (
            <Field label={`Quality ${state.quality}`} hint={state.format === "same" ? "For JPEG and WebP sources" : undefined}>
              <input
                type="range"
                min={1}
                max={100}
                value={state.quality}
                onChange={(e) => set({ quality: Number(e.target.value) })}
                className="accent-[var(--accent)] w-48"
                aria-label="Quality"
              />
            </Field>
          )}
          <Field label="File name suffix" hint={suffixOk ? "{w} and {h} become the new size" : <span className="text-danger">Letters, digits, @ . _ - + ( ) and spaces only</span>}>
            <TextInput mono value={state.suffix} onChange={(e) => set({ suffix: e.target.value })} className="w-40" aria-label="File name suffix" />
          </Field>
        </div>
      </Panel>

      <ToolBar
        end={
          <>
            <Button size="sm" variant="ghost" icon={X} disabled={!rows.length || running} onClick={() => setRows([])}>
              Clear
            </Button>
            <Button icon={FolderDown} disabled={!done.length || running} onClick={() => void saveEverything()}>
              Save all…
            </Button>
            <Button variant="primary" icon={Scaling} disabled={!opts || !suffixOk || running || !rows.some((r) => r.status !== "done" && r.info)} onClick={() => void resizeAll()}>
              {running ? `Resizing… ${done.length}/${rows.length}` : "Resize all"}
            </Button>
          </>
        }
      >
        <Button icon={ImagePlus} onClick={() => void open()}>
          Add images…
        </Button>
        {rows.length > 0 && (
          <span className="text-sm text-fg-faint tabular-nums">
            {rows.length} {rows.length === 1 ? "image" : "images"}
            {done.length ? ` · ${done.length} resized` : ""}
            {working ? ` · ${working} working` : ""}
          </span>
        )}
      </ToolBar>

      {error && <Notice>{error}</Notice>}
      {notice && <Notice tone="info">{notice}</Notice>}

      <div
        {...dropProps}
        className={cx("flex-1 min-h-56 rounded-xl border transition-colors", dragging ? "border-accent bg-accent-soft border-2 border-dashed" : "border-line bg-surface")}
      >
        {rows.length === 0 ? (
          <EmptyState icon={Scaling} title="Drop images to resize">
            Add several at once, from Open…, drag & drop or paste (⌘V). SVGs are rendered at the new size.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => {
              const t = preview(r);
              return (
                <li key={r.id} className="group flex items-center gap-3 px-3 py-2">
                  <Thumb file={r.file} />
                  <div className="min-w-0 flex-1">
                    <p className="text-base text-fg truncate">{r.out?.name ?? r.file.name}</p>
                    <p className="text-sm text-fg-faint tabular-nums flex items-center gap-1.5 flex-wrap">
                      {r.info ? `${r.info.width}×${r.info.height}` : "…"}
                      {t && (
                        <>
                          <ArrowRight size={12} aria-hidden />
                          <span className={r.out ? "text-fg" : undefined}>{r.out ? `${r.out.width}×${r.out.height}` : `${t.width}×${t.height}`}</span>
                        </>
                      )}
                      <span>·</span>
                      {formatBytes(r.file.bytes.length)}
                      {r.out && (
                        <>
                          <ArrowRight size={12} aria-hidden />
                          <span className="text-fg">{formatBytes(r.out.bytes.length)}</span>
                          <Badge tone={r.out.bytes.length <= r.file.bytes.length ? "success" : "neutral"}>{deltaPercent(r.file.bytes.length, r.out.bytes.length)}</Badge>
                        </>
                      )}
                    </p>
                    {r.status === "error" && <p className="text-sm text-danger">{r.error}</p>}
                  </div>
                  <span className="shrink-0 w-6 grid place-items-center" aria-label={r.status}>
                    {r.status === "working" && <Spinner />}
                    {r.status === "done" && <CircleCheck size={16} className="text-success" aria-hidden />}
                    {r.status === "error" && <CircleAlert size={16} className="text-danger" aria-hidden />}
                  </span>
                  <Button size="sm" variant="ghost" icon={Save} label={`Save ${r.out?.name ?? ""}`} disabled={!r.out} onClick={() => void saveOne(r)} />
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    label={`Remove ${r.file.name}`}
                    disabled={r.status === "working"}
                    onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: TOOL_ID,
  name: "Image Resize",
  category: "Design",
  description: "Resize many images at once by width, height, box or percent",
  icon: Scaling,
  keywords: ["image", "resize", "scale", "thumbnail", "batch", "shrink", "width", "height", "png", "jpg", "webp"],
  component: ImageResize,
};
