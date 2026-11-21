import { isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

const inApp = () => {
  try {
    return isTauri();
  } catch {
    return false;
  }
};

export const baseName = (path: string) => path.split(/[\\/]/).pop() || path;

/** Asks for an .svg file. Native dialog in the app, a file input in a plain browser. null = cancelled. */
export async function openSvgFile(): Promise<{ name: string; text: string } | null> {
  if (inApp()) {
    const path = await open({ multiple: false, directory: false, filters: [{ name: "SVG", extensions: ["svg"] }] });
    if (typeof path !== "string") return null;
    return { name: baseName(path), text: await readTextFile(path) };
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".svg,image/svg+xml";
    input.onchange = async () => {
      const f = input.files?.[0];
      resolve(f ? { name: f.name, text: await f.text() } : null);
    };
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

/** Reads a dropped file path (Tauri drag-drop gives paths, and adds them to the fs scope itself). */
export const readDropped = (path: string) => readTextFile(path);

/** Saves text; returns the saved file name, or null when cancelled. */
export async function saveTextFile(suggestedName: string, text: string): Promise<string | null> {
  const ext = suggestedName.split(".").pop() ?? "txt";
  if (inApp()) {
    const path = await save({ defaultPath: suggestedName, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
    if (!path) return null;
    await writeTextFile(path, text);
    return baseName(path);
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: ext === "svg" ? "image/svg+xml" : "text/plain" }));
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(a.href);
  return suggestedName;
}

export { inApp };
