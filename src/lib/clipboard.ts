import { inApp } from "../app/menuEvents";

/**
 * Clipboard text, or "" when there's none or it can't be read. In the app this goes through the clipboard-manager
 * plugin: WKWebView's navigator.clipboard.readText() would pop up a "Paste" button first.
 */
export async function readClipboardText(): Promise<string> {
  try {
    if (inApp()) {
      const { readText } = await import("@tauri-apps/plugin-clipboard-manager");
      return (await readText()) ?? "";
    }
    return (await navigator.clipboard?.readText?.()) ?? "";
  } catch {
    return "";
  }
}
