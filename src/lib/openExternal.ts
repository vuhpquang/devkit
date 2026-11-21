import { openUrl } from "@tauri-apps/plugin-opener";

/** Opens a link in the default browser (Tauri); a new tab when running in a plain browser. */
export async function openExternal(url: string) {
  try {
    await openUrl(url);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}
