# Clipboard suggestions and the ⌥Space launcher

Owner request, 2026-11-23: guess the tool from the clipboard; a global ⌥Space that opens a Spotlight-style picker
(search, arrows, Enter), with a setting to turn the global shortcut off.

## Clipboard suggestions

- `src/app/clipboard.ts` — `detectClipboard(text)` (pure): ordered suggestions `{ toolId, label, mode? }` for JWT,
  JSON, Unix/ISO timestamps, percent-encoding, Base64, XML, SQL, cron, colours, HTML entities, JS object literals.
  Nothing for empty, huge (> 1 MB) or unrecognised text.
- Reading: `src/lib/clipboard.ts` — in the app `tauri-plugin-clipboard-manager` `readText` (no paste prompt, which
  WKWebView's `navigator.clipboard.readText` would show); in a browser `navigator.clipboard.readText`, failures → "".
- Shown as a "From clipboard" group at the top of ⌘K (and the launcher) when the palette opens with an empty query.
  Choosing one opens the tool with the text: `sendTo(id, { kind: "text", text, mode })`.
- Tools take it on mount with `useHandoffText()` (tool id from `ToolIdContext`, provided by the shell): TransformTool
  (input + mode), JWT, Timestamp, Cron, Color; JSON Format already reads text hand-offs.
- Setting: General → "Suggest tools from the clipboard" (on by default). Off = the clipboard is never read.

## ⌥Space launcher

- `tauri-plugin-global-shortcut`, registered from the main window's JS while General → "Open DevKit with ⌥Space" is on
  (default on). Registration failure (another app owns ⌥Space) is shown under the setting.
- A second window `launcher` (tauri.conf: hidden, transparent, no decorations, always on top, skip taskbar, 640×440,
  `index.html?launcher`), rendering the ⌘K palette alone (same component and look; no new visual design).
- ⌥Space toggles it: centre, show, focus, reset the query and re-read the clipboard. Esc or losing focus hides it.
- Enter emits `launcher:open { id, handoff? }` to the main window, which shows and focuses itself and opens the tool.
- The main window hides on close instead of being destroyed (so the shortcut and launcher keep working); clicking
  the Dock icon shows it again; ⌘Q quits. Needs `macOSPrivateApi` for the transparent launcher.
