import { isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

const FILTERS = [{ name: "JSON", extensions: ["json", "jsonc", "geojson", "txt"] }];

const inApp = () => {
  try {
    return isTauri();
  } catch {
    return false;
  }
};

export const baseName = (path: string) => path.split(/[\\/]/).pop() || path;

/** Asks for a JSON file. Native dialog in the app, a file input in a plain browser. null = cancelled. */
export async function openJsonFile(): Promise<{ name: string; text: string } | null> {
  if (inApp()) {
    const path = await open({ multiple: false, directory: false, filters: FILTERS });
    if (typeof path !== "string") return null;
    return { name: baseName(path), text: await readTextFile(path) };
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const f = input.files?.[0];
      resolve(f ? { name: f.name, text: await f.text() } : null);
    };
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

/** Saves text as a JSON file; returns the saved file's name, or null when cancelled. */
export async function saveJsonFile(suggestedName: string, text: string): Promise<string | null> {
  if (inApp()) {
    const path = await save({ defaultPath: suggestedName, filters: FILTERS });
    if (!path) return null;
    await writeTextFile(path, text);
    return baseName(path);
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(a.href);
  return suggestedName;
}
