import { useDeferredValue, useEffect, useMemo, useState, type DragEvent } from "react";
import { Atom, FileText, FolderOpen, ImageDown, Save } from "lucide-react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import type { ToolDef } from "../types";
import {
  Button,
  EditorPane,
  Notice,
  Panel,
  Segmented,
  TextInput,
  Toggle,
  ToolBar,
  ToolBarDivider,
  ToolPage,
  type Status,
} from "../../lib/ui";
import { sendTo, takeHandoff } from "../../app/handoff";
import { componentName, componentToSvg, DEFAULT_OPTIONS, parseSvg, svgToComponent, type Mode, type Options } from "./logic";
import { optimizeSvg, savedText } from "./optimize";
import { inApp, openSvgFile, readDropped, saveTextFile } from "./files";

const KEY = "devkit.svgReact";

/** Stored options; unknown fields fall back to the defaults. */
export function loadOptions(): Options {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Record<keyof Options, unknown>>;
    const out = { ...DEFAULT_OPTIONS };
    for (const k of Object.keys(DEFAULT_OPTIONS) as (keyof Options)[]) {
      if (typeof v[k] === typeof DEFAULT_OPTIONS[k]) (out as Record<string, unknown>)[k] = v[k];
    }
    if (out.exportKind !== "default" && out.exportKind !== "named") out.exportKind = "default";
    return out;
  } catch {
    return { ...DEFAULT_OPTIONS };
  }
}

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1E2430" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <title>Folder</title>
  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="#F5A524" fill-opacity="0.25"/>
  <circle cx="12" cy="13" r="2.5"/>
</svg>
`;

const SAMPLE_JSX = `import type { SVGProps } from "react";

export const Folder = ({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" {...props}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" style={{ fillOpacity: 0.25 }} />
    <circle cx="12" cy="13" r={2.5} />
  </svg>
);
`;

type PreviewSize = "24" | "48" | "96" | "fit";

/** The SVG drawn as an image: <img> never runs scripts inside the SVG. */
function Preview({ svg, size, onSize }: { svg: string | null; size: PreviewSize; onSize: (s: PreviewSize) => void }) {
  const px = size === "fit" ? undefined : Number(size);
  return (
    <Panel
      title="Preview"
      className="min-h-[12rem]"
      actions={
        <Segmented
          label="Preview size"
          size="sm"
          value={size}
          onChange={onSize}
          options={[
            { value: "24", label: "24" },
            { value: "48", label: "48" },
            { value: "96", label: "96" },
            { value: "fit", label: "Fit" },
          ]}
        />
      }
      bodyClassName="p-3"
    >
      <div
        className="relative w-full h-full min-h-[6rem] grid place-items-center rounded-md border border-line overflow-hidden"
        style={{ background: "repeating-conic-gradient(var(--surface-3) 0% 25%, var(--surface) 0% 50%) 50% / 16px 16px" }}
      >
        {svg ? (
          <img
            alt="SVG preview"
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
            className={px ? undefined : "absolute inset-3 w-[calc(100%-1.5rem)] h-[calc(100%-1.5rem)] object-contain"}
            style={px ? { width: px, height: px } : undefined}
          />
        ) : (
          <span className="text-sm text-fg-faint">Nothing to draw yet</span>
        )}
      </div>
    </Panel>
  );
}

function SvgReact() {
  const [mode, setMode] = useState<Mode>("react");
  const [input, setInput] = useState("");
  const [opts, setOpts] = useState<Options>(loadOptions);
  const [size, setSize] = useState<PreviewSize>("fit");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const deferred = useDeferredValue(input);
  const toSvg = mode === "svg";

  const set = (patch: Partial<Options>) =>
    setOpts((o) => {
      const next = { ...o, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage blocked */
      }
      return next;
    });

  const loadFile = (name: string, text: string) => {
    setInput(text);
    if (/\.svg$/i.test(name)) {
      set({ name: componentName(name) });
      if (toSvg) setMode("react");
    }
  };

  // A tool handed over some SVG or code.
  useEffect(() => {
    const h = takeHandoff("svg-react");
    if (h?.kind === "text") setInput(h.text);
    if (h?.kind === "image" && h.mime === "image/svg+xml") loadFile(h.name, new TextDecoder().decode(h.bytes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drag & drop in the app: Tauri hands over paths, not browser File objects.
  useEffect(() => {
    if (!inApp()) return;
    let un: (() => void) | undefined;
    let live = true;
    getCurrentWebview()
      .onDragDropEvent(async (e) => {
        if (e.payload.type !== "drop") return;
        const path = e.payload.paths.find((p) => /\.svg$/i.test(p));
        if (!path) return;
        try {
          loadFile(path.split("/").pop() ?? "icon.svg", await readDropped(path));
        } catch (err) {
          setError(`Couldn't read the file: ${(err as Error).message ?? err}`);
        }
      })
      .then((u) => (live ? (un = u) : u()))
      .catch(() => {});
    return () => {
      live = false;
      un?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const computed = useMemo(() => {
    if (!deferred.trim()) return null;
    if (toSvg) {
      const r = componentToSvg(deferred);
      return { result: r, svg: r.ok ? r.value : null, optimized: null };
    }
    const optimized = opts.optimize && parseSvg(deferred).ok ? optimizeSvg(deferred) : null;
    const source = optimized?.svg ?? deferred;
    const r = svgToComponent(source, mode, opts);
    return { result: r, svg: r.ok ? source : null, optimized };
  }, [deferred, mode, opts, toSvg]);

  const output = computed?.result.ok ? computed.result.value : "";
  const status: Status = !computed
    ? { kind: "idle", text: toSvg ? "Paste a component with an <svg> in it" : "Paste SVG markup, open a file or drop one here" }
    : computed.result.ok
      ? {
          kind: "ok",
          text: [toSvg ? "Converted to SVG" : mode === "native" ? "React Native component" : "React component", ...computed.result.notes].join(" · "),
        }
      : { kind: "error", text: computed.result.error };

  const svgForImage = toSvg ? computed?.svg ?? null : parseSvg(input).ok ? (computed?.svg ?? input) : null;
  const fileName = componentName(opts.name);
  const outExt = toSvg ? "svg" : opts.typescript ? "tsx" : "jsx";

  const onDrop = async (e: DragEvent) => {
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    e.preventDefault();
    loadFile(f.name, await f.text());
  };

  return (
    <ToolPage>
      <ToolBar
        end={
          <>
            <Button size="sm" variant="ghost" icon={FileText} onClick={() => setInput(toSvg ? SAMPLE_JSX : SAMPLE_SVG)}>
              Sample
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={FolderOpen}
              onClick={async () => {
                try {
                  const f = await openSvgFile();
                  if (f) loadFile(f.name, f.text);
                } catch (err) {
                  setError(`Couldn't open the file: ${(err as Error).message ?? err}`);
                }
              }}
            >
              Open…
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={Save}
              disabled={!output}
              onClick={async () => {
                try {
                  setSaved(await saveTextFile(`${fileName}.${outExt}`, output));
                } catch (err) {
                  setError(`Couldn't save: ${(err as Error).message ?? err}`);
                }
              }}
            >
              Save…
            </Button>
            <Button
              size="sm"
              icon={ImageDown}
              disabled={!svgForImage}
              onClick={() =>
                svgForImage &&
                sendTo("image-converter", { kind: "image", name: `${fileName}.svg`, mime: "image/svg+xml", bytes: new TextEncoder().encode(svgForImage) })
              }
            >
              Convert image…
            </Button>
          </>
        }
      >
        <Segmented
          label="Direction"
          value={mode}
          onChange={setMode}
          options={[
            { value: "react", label: "SVG → React" },
            { value: "native", label: "SVG → React Native" },
            { value: "svg", label: "React → SVG" },
          ]}
        />
      </ToolBar>

      {!toSvg && (
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          <TextInput aria-label="Component name" value={opts.name} onChange={(e) => set({ name: e.target.value })} className="w-36 h-7" mono />
          <Segmented
            label="Export"
            size="sm"
            value={opts.exportKind}
            onChange={(exportKind) => set({ exportKind })}
            options={[
              { value: "default", label: "Default export" },
              { value: "named", label: "Named" },
            ]}
          />
          <ToolBarDivider />
          <Toggle size="sm" on={opts.typescript} onToggle={() => set({ typescript: !opts.typescript })}>
            TypeScript
          </Toggle>
          <Toggle size="sm" on={opts.sizeProps} onToggle={() => set({ sizeProps: !opts.sizeProps })} title="Replace width/height with a size prop (default 24)">
            size prop
          </Toggle>
          <Toggle size="sm" on={opts.spreadProps} onToggle={() => set({ spreadProps: !opts.spreadProps })}>
            {"{...props}"}
          </Toggle>
          <Toggle size="sm" on={opts.currentColor} onToggle={() => set({ currentColor: !opts.currentColor })} title="fill and stroke colours become currentColor">
            currentColor
          </Toggle>
          <Toggle size="sm" on={opts.memo} onToggle={() => set({ memo: !opts.memo })}>
            memo
          </Toggle>
          {mode === "react" && (
            <Toggle size="sm" on={opts.forwardRef} onToggle={() => set({ forwardRef: !opts.forwardRef })}>
              forwardRef
            </Toggle>
          )}
          <Toggle size="sm" on={opts.keepTitle} onToggle={() => set({ keepTitle: !opts.keepTitle })}>
            Keep &lt;title&gt;
          </Toggle>
          <Toggle size="sm" on={opts.optimize} onToggle={() => set({ optimize: !opts.optimize })} title="Run SVGO (preset-default) before converting">
            Optimize (SVGO)
          </Toggle>
          {computed?.optimized && <span className="text-sm text-fg-faint tabular-nums ml-1">{savedText(computed.optimized)}</span>}
        </div>
      )}

      {error && <Notice>{error}</Notice>}
      {saved && <Notice tone="info">Saved {saved}</Notice>}

      <div className="flex-1 min-h-0 grid gap-3 grid-cols-1 min-[760px]:grid-cols-2 auto-rows-[minmax(0,1fr)]">
        <div className="min-h-0 min-w-0 flex" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
          <EditorPane
            title={toSvg ? "Component" : "SVG"}
            value={input}
            onChange={setInput}
            lang={toSvg ? "javascript" : "xml"}
            placeholder={toSvg ? "Paste JSX / TSX with an <svg> element" : "<svg …>…</svg> — or drop an .svg file"}
            className="flex-1 min-w-0"
            autoFocus
          />
        </div>
        <div className="min-h-0 min-w-0 grid gap-3 grid-rows-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <EditorPane title={toSvg ? "SVG" : mode === "native" ? "React Native" : "React"} value={output} readOnly lang={toSvg ? "xml" : "javascript"} status={status} />
          <Preview svg={computed?.svg ?? null} size={size} onSize={setSize} />
        </div>
      </div>
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "svg-react",
  name: "SVG ↔ React",
  category: "Converters",
  description: "Turn SVG into React or React Native components, and JSX back into SVG",
  icon: Atom,
  keywords: ["svg", "react", "jsx", "tsx", "component", "svgr", "react native", "icon", "svgo", "optimize"],
  component: SvgReact,
};
