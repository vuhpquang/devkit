import { EXT, MIME, type Fit, type OutFormat, type ResizeOptions } from "../../lib/image";
import type { Handoff } from "../../app/handoff";
import { extOf, type ImageFile } from "../image-converter/files";

export type Mode = "width" | "height" | "box" | "percent";
export type FormatChoice = "same" | "png" | "jpeg" | "webp";

export interface ResizeState {
  mode: Mode;
  width: string;
  height: string;
  percent: string;
  fit: Fit;
  allowUpscale: boolean;
  format: FormatChoice;
  quality: number;
  suffix: string;
}

export const DEFAULT_STATE: ResizeState = {
  mode: "width",
  width: "1280",
  height: "720",
  percent: "50",
  fit: "fit",
  allowUpscale: false,
  format: "same",
  quality: 85,
  suffix: "@{w}x{h}",
};

export const PRESETS: { label: string; patch: Partial<ResizeState> }[] = [
  { label: "50 %", patch: { mode: "percent", percent: "50" } },
  { label: "1920 w", patch: { mode: "width", width: "1920" } },
  { label: "1280 w", patch: { mode: "width", width: "1280" } },
  { label: "1024", patch: { mode: "box", width: "1024", height: "1024", fit: "fit" } },
  { label: "512", patch: { mode: "box", width: "512", height: "512", fit: "fit" } },
  { label: "256", patch: { mode: "box", width: "256", height: "256", fit: "fit" } },
  { label: "128", patch: { mode: "box", width: "128", height: "128", fit: "fit" } },
];

/** A saved ResizeState (Settings → Remember tool input) with every field of the right kind. */
export function isResizeState(v: unknown): v is ResizeState {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const s = v as Record<string, unknown>;
  return (
    (s.mode === "width" || s.mode === "height" || s.mode === "box" || s.mode === "percent") &&
    typeof s.width === "string" &&
    typeof s.height === "string" &&
    typeof s.percent === "string" &&
    (s.fit === "fit" || s.fit === "fill" || s.fit === "exact") &&
    typeof s.allowUpscale === "boolean" &&
    (s.format === "same" || s.format === "png" || s.format === "jpeg" || s.format === "webp") &&
    typeof s.quality === "number" &&
    typeof s.suffix === "string"
  );
}

const posInt = (s: string) => {
  const n = Math.round(Number(s));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 16384) : undefined;
};

/** The resize options for the backend; null when the inputs don't make a size yet. */
export function resizeOptions(s: ResizeState): ResizeOptions | null {
  const w = posInt(s.width);
  const h = posInt(s.height);
  switch (s.mode) {
    case "width":
      return w ? { width: w, fit: "fit", allowUpscale: s.allowUpscale } : null;
    case "height":
      return h ? { height: h, fit: "fit", allowUpscale: s.allowUpscale } : null;
    case "box":
      return w && h ? { width: w, height: h, fit: s.fit, allowUpscale: s.allowUpscale } : null;
    case "percent": {
      const p = Number(s.percent);
      return Number.isFinite(p) && p > 0 ? { percent: Math.min(p, 1000), allowUpscale: s.allowUpscale } : null;
    }
  }
}

/**
 * Output size for a `w`×`h` source — mirrors `target_size` + the fill crop in src-tauri/src/img.rs, so the list
 * can show "1920×1080 → 1280×720" before anything runs. SVGs (`raster` false) scale freely.
 */
export function targetSize(w: number, h: number, r: ResizeOptions, raster: boolean): { width: number; height: number } {
  const fit = r.fit ?? "fit";
  let tw: number;
  let th: number;
  if (r.width && r.height) {
    if (fit === "exact") [tw, th] = [r.width, r.height];
    else {
      const s = fit === "fit" ? Math.min(r.width / w, r.height / h) : Math.max(r.width / w, r.height / h);
      [tw, th] = [w * s, h * s];
    }
  } else if (r.width) [tw, th] = [r.width, (h * r.width) / w];
  else if (r.height) [tw, th] = [(w * r.height) / h, r.height];
  else {
    const p = Math.min(Math.max(r.percent ?? 100, 1), 1000) / 100;
    [tw, th] = [w * p, h * p];
  }
  tw = Math.max(1, Math.round(tw));
  th = Math.max(1, Math.round(th));
  if (raster && !r.allowUpscale && (tw > w || th > h) && fit !== "exact") {
    const s = Math.min(w / tw, h / th);
    tw = Math.max(1, Math.round(tw * s));
    th = Math.max(1, Math.round(th * s));
  }
  // Fill: rasters are scaled to cover, then cropped to the box (when the scaled image covers it). SVGs are
  // rendered at the covering size without a crop, exactly like img.rs.
  if (raster && fit === "fill" && r.width && r.height && tw >= r.width && th >= r.height) return { width: r.width, height: r.height };
  return { width: Math.min(tw, 16384), height: Math.min(th, 16384) };
}

/** Output format: "same" keeps the source's, except SVG (→ PNG) and formats the resize tool doesn't write. */
export function outFormat(choice: FormatChoice, sourceName: string, sourceMime: string): OutFormat {
  if (choice !== "same") return choice;
  const ext = extOf(sourceName);
  if (ext === "jpg" || ext === "jpeg" || sourceMime === "image/jpeg") return "jpeg";
  if (ext === "webp" || sourceMime === "image/webp") return "webp";
  if (ext === "gif") return "gif";
  if (ext === "bmp") return "bmp";
  if (ext === "tif" || ext === "tiff") return "tiff";
  return "png";
}

export const mimeOf = (f: OutFormat) => MIME[f];

/** Only characters that are safe in a file name on macOS and Windows; {w} and {h} are placeholders. */
export const SUFFIX_OK = /^[A-Za-z0-9 @._+{}()x-]*$/;
export const isSafeSuffix = (s: string) => SUFFIX_OK.test(s) && s.length <= 40;

/** "photo.png" + "@{w}x{h}" + 1280×720 + jpeg → "photo@1280x720.jpg". An empty suffix keeps the name. */
export function outputName(name: string, suffix: string, w: number, h: number, format: OutFormat): string {
  const base = name.replace(/\.[^./\\]+$/, "") || "image";
  const s = isSafeSuffix(suffix) ? suffix.replace(/\{w\}/g, String(w)).replace(/\{h\}/g, String(h)) : "";
  return `${base}${s}.${EXT[format]}`;
}

/** Images from a handoff (Image Converter → "Resize…"). */
export function fromHandoff(h: Handoff | undefined): ImageFile[] {
  if (!h) return [];
  if (h.kind === "images") return h.files;
  if (h.kind === "image") return [{ name: h.name, mime: h.mime, bytes: h.bytes }];
  return [];
}

/** Runs `fn` over `items` with at most `n` in flight. */
export async function runPool<T>(items: T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const item = items[i++];
        await fn(item);
      }
    }),
  );
}
