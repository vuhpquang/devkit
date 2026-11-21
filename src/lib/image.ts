import { invoke } from "@tauri-apps/api/core";
import { NotInApp } from "./system";
import { inApp } from "../app/menuEvents";

/** Formats DevKit can write (src-tauri/src/img.rs). */
export type OutFormat = "png" | "jpeg" | "webp" | "gif" | "bmp" | "tiff" | "ico";
export type Fit = "fit" | "fill" | "exact";

export interface ResizeOptions {
  width?: number;
  height?: number;
  /** Used when width and height are both empty (1–1000). */
  percent?: number;
  fit?: Fit;
  allowUpscale?: boolean;
}

export interface ConvertOptions {
  format: OutFormat;
  /** 1–100, JPEG and lossy WebP. */
  quality?: number;
  /** WebP only. */
  lossless?: boolean;
  /** RGB under transparent pixels for JPEG / BMP (default white). */
  background?: [number, number, number];
  resize?: ResizeOptions;
  /** ICO only: square sizes 16–256. */
  icoSizes?: number[];
}

export interface Converted {
  bytes: Uint8Array;
  /** 0 for ICO (several sizes). */
  width: number;
  height: number;
}

export interface ImageInfo {
  format: string;
  width: number;
  height: number;
  hasAlpha: boolean;
}

export const EXT: Record<OutFormat, string> = { png: "png", jpeg: "jpg", webp: "webp", gif: "gif", bmp: "bmp", tiff: "tiff", ico: "ico" };
export const MIME: Record<OutFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  tiff: "image/tiff",
  ico: "image/x-icon",
};

function errorText(e: unknown): Error {
  return new Error(typeof e === "string" ? e : (e as Error).message ?? String(e));
}

/** Decode → resize → encode in Rust. The bytes go over IPC as a raw body, not JSON. */
export async function convertImage(input: Uint8Array, options: ConvertOptions): Promise<Converted> {
  if (!inApp()) throw new NotInApp();
  try {
    const buf = await invoke<ArrayBuffer>("image_convert", input, { headers: { "x-devkit-options": JSON.stringify(options) } });
    const view = new DataView(buf);
    return { width: view.getUint32(0, true), height: view.getUint32(4, true), bytes: new Uint8Array(buf, 8) };
  } catch (e) {
    throw errorText(e);
  }
}

export async function imageInfo(input: Uint8Array): Promise<ImageInfo> {
  if (!inApp()) throw new NotInApp();
  try {
    return await invoke<ImageInfo>("image_info", input);
  } catch (e) {
    throw errorText(e);
  }
}

/** "photo.final.png" + webp → "photo.final.webp" */
export function renameExt(name: string, format: OutFormat): string {
  const base = name.replace(/\.[^./\\]+$/, "") || "image";
  return `${base}.${EXT[format]}`;
}

/** 1536 → "1.5 KB" */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
