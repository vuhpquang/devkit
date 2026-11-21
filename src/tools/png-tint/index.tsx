import { useCallback, useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { FileText, FolderOpen, ImageUp, PaintBucket } from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import type { ToolDef } from "../types";
import { Button, EmptyState, Notice, Panel, Segmented, TextInput, ToolBar, ToolPage, cx } from "../../lib/ui";
import { PRESETS, SIZE_MAX, SIZE_MIN, clampSize, fileName, isImageUrl, isPng, normalizeHex, toPickerValue } from "./logic";

type Bg = "checker" | "light" | "dark";

/** Preview backgrounds. Light/Dark are fixed colours (like a swatch), so they don't follow the app theme. */
const BG: Record<Bg, CSSProperties> = {
  checker: {
    background: "repeating-conic-gradient(var(--surface-3) 0% 25%, var(--surface) 0% 50%) 50% / 16px 16px",
  },
  light: { background: "#ffffff" },
  dark: { background: "#161a23" },
};

const inApp = () => {
  try {
    return isTauri();
  } catch {
    return false;
  }
};

/** A built-in PNG to try the tool with: a bold "{ }" drawn on a transparent canvas. */
function samplePng(): string | null {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#000";
  g.font = "bold 150px ui-monospace, Menlo, monospace";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("{ }", 128, 136);
  return c.toDataURL("image/png");
}

function PngTint() {
  const [src, setSrc] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [tint, setTint] = useState("#eb2f96");
  const [hexText, setHexText] = useState("#eb2f96");
  const [url, setUrl] = useState("");
  const [size, setSize] = useState(220);
  const [bg, setBg] = useState<Bg>("checker");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const blobUrl = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  /** Shows a new image; the previous blob URL is released. */
  const show = useCallback((next: string, name: string, isBlob = false) => {
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    blobUrl.current = isBlob ? next : null;
    setSrc(next);
    setLabel(name);
    setError(null);
  }, []);
  useEffect(() => () => void (blobUrl.current && URL.revokeObjectURL(blobUrl.current)), []);

  const showBlob = useCallback((blob: Blob, name: string) => show(URL.createObjectURL(blob), name, true), [show]);

  const loadPath = useCallback(
    async (path: string) => {
      if (!isPng(path)) {
        setError(`${fileName(path)} isn't a PNG. Pick a .png file.`);
        return;
      }
      try {
        const { readFile } = await import("@tauri-apps/plugin-fs");
        const bytes = await readFile(path);
        showBlob(new Blob([bytes], { type: "image/png" }), fileName(path));
      } catch (e) {
        setError(`Couldn't open ${fileName(path)}: ${(e as Error).message ?? e}`);
      }
    },
    [showBlob],
  );

  const openFile = async () => {
    if (!inApp()) {
      fileInput.current?.click();
      return;
    }
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const path = await open({ multiple: false, directory: false, filters: [{ name: "PNG image", extensions: ["png"] }] });
      if (typeof path === "string") await loadPath(path);
    } catch (e) {
      setError(`Couldn't open the file: ${(e as Error).message ?? e}`);
    }
  };

  // In the app, files dropped on the window arrive as Tauri events (the webview never sees them).
  useEffect(() => {
    if (!inApp()) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    import("@tauri-apps/api/webview")
      .then(({ getCurrentWebview }) =>
        getCurrentWebview().onDragDropEvent((e) => {
          const p = e.payload;
          if (p.type === "enter") setDragging(true);
          else if (p.type === "leave") setDragging(false);
          else if (p.type === "drop") {
            setDragging(false);
            const png = p.paths.find((x) => isPng(x));
            if (png) void loadPath(png);
            else if (p.paths.length) setError("Drop a .png file.");
          }
        }),
      )
      .then((u) => (cancelled ? u() : (unlisten = u)))
      .catch(() => {});
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [loadPath]);

  // Paste an image (e.g. a screenshot or a copied PNG).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.kind === "file" && i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (!file) return;
      e.preventDefault();
      showBlob(file, file.name || "Pasted image");
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [showBlob]);

  // Browser fallback for drag and drop.
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = [...e.dataTransfer.files].find((f) => isPng(f.name, f.type));
    if (file) showBlob(file, file.name);
    else if (e.dataTransfer.files.length) setError("Drop a .png file.");
  };

  const applyHex = (text: string) => {
    setHexText(text);
    const n = normalizeHex(text);
    if (n) setTint(n);
  };
  const pick = (hex: string) => {
    setTint(hex);
    setHexText(hex);
  };
  const hexInvalid = normalizeHex(hexText) === null;

  const loadUrl = () => {
    const u = url.trim();
    if (!u) return;
    if (!isImageUrl(u)) {
      setError("Enter an http(s) URL of a PNG, e.g. https://example.com/icon.png");
      return;
    }
    show(u, u);
  };

  const box: CSSProperties = { width: size, height: size };
  const mask: CSSProperties = src
    ? {
        ...box,
        backgroundColor: tint,
        maskImage: `url("${src}")`,
        WebkitMaskImage: `url("${src}")`,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }
    : box;

  return (
    <ToolPage>
      <ToolBar
        end={
          <Button
            size="sm"
            variant="ghost"
            icon={FileText}
            onClick={() => {
              const s = samplePng();
              if (s) show(s, "Sample");
            }}
          >
            Sample
          </Button>
        }
      >
        <Button icon={FolderOpen} onClick={() => void openFile()}>
          Open PNG…
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="image/png"
          hidden
          aria-label="PNG file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) showBlob(f, f.name);
            e.target.value = "";
          }}
        />
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            loadUrl();
          }}
        >
          <TextInput aria-label="PNG URL" placeholder="or paste a PNG URL…" value={url} onChange={(e) => setUrl(e.target.value)} className="w-72" mono />
          <Button type="submit" disabled={!url.trim()}>
            Load
          </Button>
        </form>
      </ToolBar>

      <Panel className="shrink-0" bodyClassName="px-3 py-2.5 flex items-center gap-3 flex-wrap" title="Tint" icon={PaintBucket}>
        <div role="group" aria-label="Preset colours" className="flex items-center gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.hex}
              type="button"
              title={`${p.name} ${p.hex}`}
              aria-label={`${p.name} ${p.hex}`}
              aria-pressed={tint === p.hex}
              onClick={() => pick(p.hex)}
              className={cx(
                "h-7 w-7 rounded-md border border-line-strong outline-none focus-visible:ring-2 focus-visible:ring-accent-ring",
                tint === p.hex && "ring-2 ring-accent ring-offset-2 ring-offset-surface",
              )}
              style={{ background: p.hex }}
            />
          ))}
        </div>
        <span className="w-px h-6 bg-line" aria-hidden />
        <input
          type="color"
          aria-label="Pick a colour"
          value={toPickerValue(tint)}
          onChange={(e) => pick(e.target.value)}
          className="h-8 w-10 rounded-md border border-line-strong bg-surface p-0.5 cursor-default"
        />
        <TextInput
          aria-label="Hex colour"
          aria-invalid={hexInvalid}
          value={hexText}
          onChange={(e) => applyHex(e.target.value)}
          className={cx("w-32", hexInvalid && "!border-danger")}
          mono
        />
        {hexInvalid && <span className="text-sm text-danger">Use #rgb, #rrggbb or #rrggbbaa</span>}
      </Panel>

      {error && <Notice>{error}</Notice>}

      <Panel
        className="flex-1"
        title="Preview"
        meta={label || undefined}
        actions={
          <div className="flex items-center gap-3 pr-1">
            <label className="flex items-center gap-2 text-sm text-fg-muted">
              Size
              <input
                type="range"
                min={SIZE_MIN}
                max={SIZE_MAX}
                value={size}
                onChange={(e) => setSize(clampSize(Number(e.target.value)))}
                className="w-32 accent-[var(--accent)]"
                aria-label="Preview size"
              />
              <span className="tabular-nums w-12">{size} px</span>
            </label>
            <Segmented<Bg>
              label="Background"
              size="sm"
              value={bg}
              onChange={setBg}
              options={[
                { value: "checker", label: "Checker" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
          </div>
        }
        bodyClassName="overflow-auto"
      >
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cx("h-full min-h-64 relative", dragging && "outline-2 outline-dashed outline-accent -outline-offset-8 bg-accent-soft")}
        >
          {src ? (
            <div className="h-full grid grid-cols-1 min-[720px]:grid-cols-2 gap-4 p-4">
              {[
                { title: "Original", node: <img src={src} alt="Original PNG" style={{ ...box, objectFit: "contain" }} onError={() => setError("Couldn't load that image. Check the URL, or open the file instead.")} /> },
                { title: `Tinted ${tint}`, node: <div role="img" aria-label={`PNG tinted ${tint}`} style={mask} /> },
              ].map((c) => (
                <figure key={c.title} className="flex flex-col min-h-0 m-0">
                  <figcaption className="text-sm font-medium text-fg-muted mb-2 font-mono">{c.title}</figcaption>
                  <div className="flex-1 min-h-48 grid place-items-center rounded-lg border border-line overflow-auto p-4" style={BG[bg]}>
                    {c.node}
                  </div>
                </figure>
              ))}
            </div>
          ) : (
            <EmptyState icon={ImageUp} title="Drop a PNG here">
              Or open one, paste an image (⌘V), load a URL, or try the Sample. The PNG's transparency becomes the shape; the
              tint colour fills it.
            </EmptyState>
          )}
        </div>
      </Panel>
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "png-tint",
  name: "PNG Tint Tester",
  category: "Design",
  description: "Preview a PNG icon tinted with any colour, like a template image",
  icon: PaintBucket,
  keywords: ["png", "tint", "icon", "mask", "colour", "color", "template", "image"],
  component: PngTint,
};
