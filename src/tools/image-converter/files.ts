import { useCallback, useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { useToolActive } from "../../lib/toolActive";

/**
 * Loading and saving images for Image Converter and Image Resize.
 * In the app: Tauri dialogs + plugin-fs (binary readFile / writeFile) and the window's drag & drop event.
 * In a plain browser (npm run dev): <input type=file>, HTML drop and download links.
 */

export interface ImageFile {
  name: string;
  mime: string;
  bytes: Uint8Array;
}

export const IMAGE_EXTS = ["svg", "png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff", "ico"] as const;

const MIME_BY_EXT: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  ico: "image/x-icon",
};

export const extOf = (name: string) => (name.match(/\.([^./\\]+)$/)?.[1] ?? "").toLowerCase();

/** MIME type from the file name; "" when it isn't an image DevKit reads. */
export const mimeFor = (name: string) => MIME_BY_EXT[extOf(name)] ?? "";

export const isImageName = (name: string) => mimeFor(name) !== "";

/** "/Users/a/b/photo.png" or "C:\\x\\photo.png" → "photo.png" */
export const baseName = (path: string) => path.split(/[/\\]/).pop() || path;

/**
 * Makes names unique: "a.png", "a.png" → "a.png", "a (1).png". `taken` holds names already in the target folder,
 * so a batch save never overwrites a file that was there before.
 */
export function uniqueNames(names: string[], taken: Iterable<string> = []): string[] {
  const seen = new Set<string>([...taken].map((t) => t.toLowerCase()));
  return names.map((n) => {
    if (!seen.has(n.toLowerCase())) {
      seen.add(n.toLowerCase());
      return n;
    }
    const m = n.match(/^(.*?)(\.[^.]+)?$/)!;
    for (let i = 1; ; i++) {
      const candidate = `${m[1]} (${i})${m[2] ?? ""}`;
      if (!seen.has(candidate.toLowerCase())) {
        seen.add(candidate.toLowerCase());
        return candidate;
      }
    }
  });
}

export const inApp = () => {
  try {
    return isTauri();
  } catch {
    return false;
  }
};

/** A checkerboard behind transparent previews, drawn from tokens so it follows light/dark. */
export const CHECKER: CSSProperties = {
  background: "repeating-conic-gradient(var(--surface-3) 0% 25%, var(--surface) 0% 50%) 50% / 16px 16px",
};

async function readPath(path: string): Promise<ImageFile> {
  const { readFile } = await import("@tauri-apps/plugin-fs");
  const name = baseName(path);
  return { name, mime: mimeFor(name) || "application/octet-stream", bytes: await readFile(path) };
}

async function fromBlob(file: File | Blob, name?: string): Promise<ImageFile> {
  const n = name ?? (file as File).name ?? "image";
  return { name: n, mime: file.type || mimeFor(n), bytes: new Uint8Array(await file.arrayBuffer()) };
}

/** Browser fallback for Open…: a hidden file input. */
function pickWithInput(multiple: boolean): Promise<ImageFile[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = multiple;
    input.accept = IMAGE_EXTS.map((e) => `.${e}`).join(",");
    input.onchange = async () => resolve(await Promise.all([...(input.files ?? [])].map((f) => fromBlob(f))));
    input.click();
  });
}

/** Open… dialog. Resolves to [] when cancelled. */
export async function pickImages(multiple: boolean): Promise<ImageFile[]> {
  if (!inApp()) return pickWithInput(multiple);
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({
    multiple,
    directory: false,
    filters: [{ name: "Images", extensions: [...IMAGE_EXTS] }],
  });
  const paths = picked === null ? [] : Array.isArray(picked) ? picked : [picked];
  return Promise.all(paths.map(readPath));
}

function download(file: ImageFile) {
  const url = URL.createObjectURL(new Blob([file.bytes as BlobPart], { type: file.mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Save… one file. Returns the written path, "download" in a browser, or null when cancelled. */
export async function saveFile(file: ImageFile): Promise<string | null> {
  if (!inApp()) {
    download(file);
    return "download";
  }
  const { save } = await import("@tauri-apps/plugin-dialog");
  const ext = extOf(file.name);
  const path = await save({ defaultPath: file.name, filters: ext ? [{ name: ext.toUpperCase(), extensions: [ext] }] : [] });
  if (!path) return null;
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  await writeFile(path, file.bytes);
  return path;
}

/**
 * Save all into a folder the user picks. A name that already exists there (or twice in the batch) gets " (1)",
 * " (2)" … — nothing is ever overwritten. Returns the folder, "download", or null when cancelled.
 */
export async function saveAll(files: ImageFile[]): Promise<string | null> {
  if (!inApp()) {
    const names = uniqueNames(files.map((f) => f.name));
    files.forEach((f, i) => download({ ...f, name: names[i] }));
    return "download";
  }
  const { open } = await import("@tauri-apps/plugin-dialog");
  const dir = await open({ directory: true, recursive: true, multiple: false, title: "Save images to…" });
  if (typeof dir !== "string") return null;
  const { exists, writeFile } = await import("@tauri-apps/plugin-fs");
  const folder = dir.replace(/\/+$/, "");
  const wanted = files.map((f) => f.name);
  const taken: string[] = [];
  for (const n of new Set(wanted)) if (await exists(`${folder}/${n}`)) taken.push(n);
  // A " (1)" variant could exist too: keep checking until every chosen name is free on disk.
  let names = uniqueNames(wanted, taken);
  for (let guard = 0; guard < 20; guard++) {
    const clash: string[] = [];
    for (let i = 0; i < names.length; i++) if (names[i] !== wanted[i] && (await exists(`${folder}/${names[i]}`))) clash.push(names[i]);
    if (!clash.length) break;
    taken.push(...clash);
    names = uniqueNames(wanted, taken);
  }
  for (let i = 0; i < files.length; i++) await writeFile(`${folder}/${names[i]}`, files[i].bytes);
  return dir;
}

/** A blob: URL for previews, revoked when the bytes change or the component unmounts. */
export function useBlobUrl(bytes: Uint8Array | null | undefined, mime: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!bytes) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime || "application/octet-stream" }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [bytes, mime]);
  return url;
}

/**
 * Drag & drop and paste. In the app, files dropped on the window arrive as Tauri events (the webview never
 * sees them); in a browser, spread `dropProps` on the drop zone. Paste (⌘V) of an image works in both.
 */
export function useImageInput(onFiles: (files: ImageFile[]) => void, onError: (message: string) => void) {
  const active = useToolActive();
  const [dragging, setDragging] = useState(false);
  const handler = useRef(onFiles);
  handler.current = onFiles;
  const errorRef = useRef(onError);
  errorRef.current = onError;

  const acceptPaths = useCallback(async (paths: string[]) => {
    const images = paths.filter(isImageName);
    if (!images.length) return errorRef.current("Drop an image: SVG, PNG, JPEG, WebP, GIF, BMP, TIFF or ICO.");
    try {
      handler.current(await Promise.all(images.map(readPath)));
    } catch (e) {
      errorRef.current(`Couldn't open the file: ${(e as Error).message ?? e}`);
    }
  }, []);

  useEffect(() => {
    if (!inApp() || !active) return;
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
            void acceptPaths(p.paths);
          }
        }),
      )
      .then((u) => (cancelled ? u() : (unlisten = u)))
      .catch(() => {});
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [acceptPaths, active]);

  useEffect(() => {
    if (!active) return;
    const onPaste = async (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.items ?? [])]
        .filter((i) => i.kind === "file" && i.type.startsWith("image/"))
        .map((i) => i.getAsFile())
        .filter((f): f is File => !!f);
      if (!files.length) return;
      e.preventDefault();
      handler.current(await Promise.all(files.map((f, i) => fromBlob(f, f.name || `pasted-${i + 1}.${f.type.split("/")[1] || "png"}`))));
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [active]);

  const dropProps = {
    onDragOver: (e: DragEvent) => {
      if (inApp()) return;
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: async (e: DragEvent) => {
      if (inApp()) return;
      e.preventDefault();
      setDragging(false);
      const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/") || isImageName(f.name));
      if (!files.length) return errorRef.current("Drop an image: SVG, PNG, JPEG, WebP, GIF, BMP, TIFF or ICO.");
      handler.current(await Promise.all(files.map((f) => fromBlob(f))));
    },
  };

  return { dragging, dropProps };
}
