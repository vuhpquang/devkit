import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FolderOpen, ImageDown, ImagePlus, Lock, LockOpen, Save, Scaling, X } from "lucide-react";
import type { ToolDef } from "../types";
import { Badge, Button, EmptyState, Field, Notice, Panel, Segmented, Spinner, TextInput, Toggle, ToolBar, ToolPage, cx } from "../../lib/ui";
import { convertImage, formatBytes, imageInfo, MIME, renameExt, type Converted, type ImageInfo, type OutFormat } from "../../lib/image";
import { sendTo, takeHandoff } from "../../app/handoff";
import { CHECKER, pickImages, saveFile, useBlobUrl, useImageInput, type ImageFile } from "./files";
import { useSaved } from "../../lib/saved";
import {
  buildOptions,
  DEFAULT_STATE,
  deltaPercent,
  FORMATS,
  fromHandoff,
  ICO_SIZES,
  isConverterState,
  lockedOther,
  svgPresets,
  usesBackground,
  usesQuality,
  type ConverterState,
  type SizeMode,
} from "./logic";

const TOOL_ID = "image-converter";

function Preview({ url, alt, empty }: { url: string | null; alt: string; empty?: React.ReactNode }) {
  return (
    <div className="h-full min-h-48 grid place-items-center p-4 overflow-hidden" style={CHECKER}>
      {url ? <img src={url} alt={alt} className="max-w-full max-h-full object-contain" draggable={false} /> : empty}
    </div>
  );
}

function ImageConverter() {
  const [source, setSource] = useState<ImageFile | null>(null);
  const [info, setInfo] = useState<ImageInfo | null>(null);
  // Options are saved; the image and the result are not.
  const [state, setState] = useSaved<ConverterState>("options", DEFAULT_STATE, { valid: isConverterState });
  const [lock, setLock] = useSaved("lockAspect", true);
  const [result, setResult] = useState<Converted | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const run = useRef(0);

  const load = useCallback(async (file: ImageFile) => {
    setSource(file);
    setResult(null);
    setSaved(null);
    setError(null);
    setInfo(null);
    try {
      const i = await imageInfo(file.bytes);
      setInfo(i);
      // SVGs start at 2× so a 24 px icon doesn't come out tiny.
      if (i.format === "svg") setState((s) => ({ ...s, sizeMode: "size", width: String(i.width * 2), height: String(i.height * 2) }));
      else setState((s) => (s.sizeMode === "size" ? { ...s, sizeMode: "original", width: "", height: "" } : s));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // A result handed over by another tool (SVG ↔ React → "Convert image…").
  useEffect(() => {
    const f = fromHandoff(takeHandoff(TOOL_ID));
    if (f) void load(f);
  }, [load]);

  const { dragging, dropProps } = useImageInput((files) => files[0] && void load(files[0]), setError);

  const options = useMemo(() => buildOptions(state), [state]);

  // Re-convert when the source or the options change (debounced).
  useEffect(() => {
    if (!source || !info) return;
    const id = ++run.current;
    setWorking(true);
    const t = setTimeout(async () => {
      try {
        const r = await convertImage(source.bytes, options);
        if (id === run.current) {
          setResult(r);
          setError(null);
        }
      } catch (e) {
        if (id === run.current) {
          setResult(null);
          setError((e as Error).message);
        }
      } finally {
        if (id === run.current) setWorking(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [source, info, options]);

  const srcUrl = useBlobUrl(source?.bytes, source?.mime ?? "");
  const outMime = MIME[state.format];
  const outUrl = useBlobUrl(result?.bytes, outMime);
  const outName = source ? renameExt(source.name, state.format) : "";
  const isSvg = info?.format === "svg";
  const set = (patch: Partial<ConverterState>) => setState((s) => ({ ...s, ...patch }));

  const setSide = (side: "width" | "height", value: string) => {
    if (!lock || !info) return set({ [side]: value });
    const other = lockedOther(info.width, info.height, side, value);
    set(side === "width" ? { width: value, height: other } : { height: value, width: other });
  };

  const open = async () => {
    try {
      const [f] = await pickImages(false);
      if (f) await load(f);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const save = async () => {
    if (!result) return;
    try {
      const where = await saveFile({ name: outName, mime: outMime, bytes: result.bytes });
      if (where) setSaved(where === "download" ? `Downloaded ${outName}` : `Saved to ${where}`);
    } catch (e) {
      setError(`Couldn't save: ${(e as Error).message ?? e}`);
    }
  };

  if (!source) {
    return (
      <ToolPage>
        <div
          {...dropProps}
          className={cx(
            "flex-1 rounded-xl border-2 border-dashed grid place-items-center transition-colors",
            dragging ? "border-accent bg-accent-soft" : "border-line-strong",
          )}
        >
          <EmptyState icon={ImageDown} title="Drop an image to convert">
            <p>SVG, PNG, JPEG, WebP, GIF, BMP, TIFF or ICO in — PNG, JPEG, WebP, GIF, BMP, TIFF or ICO out.</p>
            <p className="mt-1">Or paste one (⌘V).</p>
            <Button className="mt-4" variant="primary" icon={FolderOpen} onClick={() => void open()}>
              Open image…
            </Button>
          </EmptyState>
        </div>
        {error && <Notice>{error}</Notice>}
      </ToolPage>
    );
  }

  return (
    <ToolPage scroll>
      <ToolBar
        end={
          <>
            <Button size="sm" variant="ghost" icon={X} onClick={() => setSource(null)}>
              Clear
            </Button>
            <Button size="sm" icon={FolderOpen} onClick={() => void open()}>
              Open…
            </Button>
          </>
        }
      >
        <span className="text-base text-fg-muted">Convert to</span>
        <Segmented<OutFormat> label="Output format" size="sm" value={state.format} onChange={(format) => set({ format })} options={FORMATS} />
      </ToolBar>

      {error && <Notice>{error}</Notice>}
      {saved && <Notice tone="info">{saved}</Notice>}

      <div {...dropProps} className="grid gap-3 grid-cols-1 min-[900px]:grid-cols-2 shrink-0">
        <Panel
          title="Source"
          className={cx("h-80", dragging && "ring-2 ring-accent")}
          meta={
            info
              ? `${info.format.toUpperCase()} · ${info.width}×${info.height} · ${formatBytes(source.bytes.length)}`
              : formatBytes(source.bytes.length)
          }
        >
          <Preview url={srcUrl} alt={source.name} />
        </Panel>
        <Panel
          title="Result"
          className="h-80"
          meta={
            result
              ? `${state.format === "ico" ? `ICO · ${options.icoSizes?.join(", ")} px` : `${result.width}×${result.height}`} · ${formatBytes(result.bytes.length)}`
              : undefined
          }
          actions={
            <>
              {result && (
                <Badge tone={result.bytes.length <= source.bytes.length ? "success" : "neutral"}>
                  {deltaPercent(source.bytes.length, result.bytes.length)}
                </Badge>
              )}
              {working && <Spinner />}
            </>
          }
        >
          <Preview url={outUrl} alt={outName} empty={working ? <Spinner size={18} /> : null} />
        </Panel>
      </div>

      <Panel title="Options" className="shrink-0" bodyClassName="p-4 flex flex-col gap-4">
        {usesQuality(state.format, state.lossless) && (
          <Field label="Quality" hint={<span className="font-mono text-fg">{state.quality}</span>}>
            <input
              type="range"
              min={1}
              max={100}
              value={state.quality}
              onChange={(e) => set({ quality: Number(e.target.value) })}
              className="accent-[var(--accent)] w-full max-w-md"
              aria-label="Quality"
            />
          </Field>
        )}
        {state.format === "webp" && (
          <div className="flex items-center gap-2">
            <Toggle size="sm" on={state.lossless} onToggle={() => set({ lossless: !state.lossless })}>
              Lossless
            </Toggle>
            <span className="text-sm text-fg-faint">Exact pixels, bigger file</span>
          </div>
        )}
        {usesBackground(state.format) && (
          <Field label="Background" hint="Used under transparent pixels">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={state.background}
                onChange={(e) => set({ background: e.target.value })}
                aria-label="Background colour"
                className="h-8 w-12 rounded-md border border-line-strong bg-surface"
              />
              <span className="font-mono text-sm text-fg-muted">{state.background}</span>
            </div>
          </Field>
        )}
        {state.format === "ico" ? (
          <Field label="Sizes inside the .ico" hint="16, 32, 48 and 256 make a complete favicon">
            <div className="flex flex-wrap gap-1.5">
              {ICO_SIZES.map((s) => {
                const on = state.icoSizes.includes(s);
                return (
                  <Toggle
                    key={s}
                    size="sm"
                    mono
                    on={on}
                    onToggle={() => set({ icoSizes: on ? state.icoSizes.filter((x) => x !== s) : [...state.icoSizes, s] })}
                  >
                    {s}
                  </Toggle>
                );
              })}
            </div>
          </Field>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-fg-muted">{isSvg ? "Render at" : "Size"}</span>
              <Segmented<SizeMode>
                label="Size"
                size="sm"
                value={state.sizeMode}
                onChange={(sizeMode) => set({ sizeMode })}
                options={[
                  { value: "original", label: isSvg ? "Natural size" : "Original" },
                  { value: "size", label: "Width × Height" },
                  { value: "percent", label: "Scale %" },
                ]}
              />
              {isSvg && info && (
                <div className="flex gap-1">
                  {svgPresets(info.width, info.height).map((p) => (
                    <Toggle
                      key={p.label}
                      size="sm"
                      on={state.sizeMode === "size" && state.width === String(p.width) && state.height === String(p.height)}
                      onToggle={() => set({ sizeMode: "size", width: String(p.width), height: String(p.height) })}
                    >
                      {p.label}
                    </Toggle>
                  ))}
                </div>
              )}
            </div>
            {state.sizeMode === "size" && (
              <div className="flex items-center gap-2">
                <TextInput aria-label="Width" inputMode="numeric" value={state.width} onChange={(e) => setSide("width", e.target.value)} className="w-24 text-right tabular-nums" placeholder="Width" />
                <Button size="sm" variant="ghost" icon={lock ? Lock : LockOpen} label={lock ? "Aspect ratio locked" : "Aspect ratio free"} aria-pressed={lock} onClick={() => setLock(!lock)} />
                <TextInput aria-label="Height" inputMode="numeric" value={state.height} onChange={(e) => setSide("height", e.target.value)} className="w-24 text-right tabular-nums" placeholder="Height" />
                <span className="text-sm text-fg-faint">px</span>
              </div>
            )}
            {state.sizeMode === "percent" && (
              <div className="flex items-center gap-2">
                <TextInput aria-label="Scale percent" inputMode="decimal" value={state.percent} onChange={(e) => set({ percent: e.target.value })} className="w-24 text-right tabular-nums" />
                <span className="text-sm text-fg-faint">%</span>
              </div>
            )}
          </div>
        )}
      </Panel>

      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm text-fg-faint truncate">{outName}</span>
        <div className="flex-1" />
        <Button
          icon={Scaling}
          disabled={!result || state.format === "ico"}
          onClick={() => result && sendTo("image-resize", { kind: "images", files: [{ name: outName, mime: outMime, bytes: result.bytes }] })}
        >
          Resize…
        </Button>
        <Button variant="primary" icon={Save} disabled={!result || working} onClick={() => void save()}>
          Save…
        </Button>
      </div>
      <p className="text-sm text-fg-faint shrink-0 flex items-center gap-1.5">
        <ImagePlus size={13} aria-hidden /> Drop or paste (⌘V) another image any time to replace the source.
      </p>
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: TOOL_ID,
  name: "Image Converter",
  category: "Design",
  description: "Convert SVG, PNG, JPEG, WebP, GIF, BMP, TIFF and ICO images",
  icon: ImageDown,
  keywords: ["image", "convert", "svg", "png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff", "ico", "favicon", "export"],
  component: ImageConverter,
};
