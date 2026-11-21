import type { ConvertOptions, OutFormat, ResizeOptions } from "../../lib/image";
import type { Handoff } from "../../app/handoff";
import type { ImageFile } from "./files";

export const FORMATS: { value: OutFormat; label: string }[] = [
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPEG" },
  { value: "webp", label: "WebP" },
  { value: "gif", label: "GIF" },
  { value: "bmp", label: "BMP" },
  { value: "tiff", label: "TIFF" },
  { value: "ico", label: "ICO" },
];

export const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256] as const;
export const DEFAULT_ICO = [16, 32, 48, 256];

/** Quality applies to JPEG and to WebP when it isn't lossless. */
export const usesQuality = (f: OutFormat, lossless: boolean) => f === "jpeg" || (f === "webp" && !lossless);
/** Formats without transparency get a background colour. */
export const usesBackground = (f: OutFormat) => f === "jpeg" || f === "bmp";

/** "#ff8800" → [255, 136, 0]; anything else → white. */
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [255, 255, 255];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export type SizeMode = "original" | "size" | "percent";

export interface ConverterState {
  format: OutFormat;
  quality: number;
  lossless: boolean;
  background: string;
  sizeMode: SizeMode;
  width: string;
  height: string;
  percent: string;
  icoSizes: number[];
}

export const DEFAULT_STATE: ConverterState = {
  format: "png",
  quality: 85,
  lossless: false,
  background: "#ffffff",
  sizeMode: "original",
  width: "",
  height: "",
  percent: "100",
  icoSizes: DEFAULT_ICO,
};

const posInt = (s: string) => {
  const n = Math.round(Number(s));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 16384) : undefined;
};

/** The resize part of the options; undefined = keep the source size. */
export function resizeFor(s: ConverterState): ResizeOptions | undefined {
  if (s.format === "ico") return undefined;
  if (s.sizeMode === "size") {
    const width = posInt(s.width);
    const height = posInt(s.height);
    if (!width && !height) return undefined;
    // Both set with the lock on means the numbers already keep the aspect; "exact" avoids rounding drift.
    return { width, height, fit: width && height ? "exact" : "fit", allowUpscale: true };
  }
  if (s.sizeMode === "percent") {
    const p = Number(s.percent);
    if (!Number.isFinite(p) || p <= 0 || p === 100) return undefined;
    return { percent: Math.min(p, 1000), allowUpscale: true };
  }
  return undefined;
}

export function buildOptions(s: ConverterState): ConvertOptions {
  const o: ConvertOptions = { format: s.format };
  if (usesQuality(s.format, s.lossless)) o.quality = Math.min(100, Math.max(1, Math.round(s.quality)));
  if (s.format === "webp") o.lossless = s.lossless;
  if (usesBackground(s.format)) o.background = hexToRgb(s.background);
  if (s.format === "ico") o.icoSizes = s.icoSizes.length ? [...s.icoSizes].sort((a, b) => a - b) : DEFAULT_ICO;
  const r = resizeFor(s);
  if (r) o.resize = r;
  return o;
}

/** With the aspect locked, the other side follows: 400×200, width → 100 gives height 50. */
export function lockedOther(srcW: number, srcH: number, changed: "width" | "height", value: string): string {
  const n = Number(value);
  if (!value.trim() || !Number.isFinite(n) || n <= 0 || !srcW || !srcH) return "";
  const other = changed === "width" ? (n * srcH) / srcW : (n * srcW) / srcH;
  return String(Math.max(1, Math.round(other)));
}

/** SVGs have no pixel size worth keeping: offer 1×, 2×, 3× of the viewBox and 512 / 1024 wide. */
export function svgPresets(w: number, h: number): { label: string; width: number; height: number }[] {
  const out = [1, 2, 3].map((k) => ({ label: `${k}×`, width: Math.round(w * k), height: Math.round(h * k) }));
  for (const side of [512, 1024]) {
    const s = side / Math.max(w, h || 1);
    out.push({ label: String(side), width: Math.round(w * s), height: Math.round(h * s) });
  }
  return out;
}

/** Size change as a signed percentage: 1000 → 370 = "−63 %". */
export function deltaPercent(before: number, after: number): string {
  if (!before) return "";
  const d = Math.round(((after - before) / before) * 100);
  if (d === 0) return "±0 %";
  return d < 0 ? `−${Math.abs(d)} %` : `+${d} %`;
}

/** The first image of a handoff (SVG ↔ React sends one SVG). */
export function fromHandoff(h: Handoff | undefined): ImageFile | null {
  if (!h) return null;
  if (h.kind === "image") return { name: h.name, mime: h.mime, bytes: h.bytes };
  if (h.kind === "images") return h.files[0] ?? null;
  return null;
}
