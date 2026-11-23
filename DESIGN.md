---
name: DevKit
platform: desktop-web
appearance: light+dark      # System / Light / Dark switch in the sidebar footer
tokens: src/index.css
dials:
  variance: 2              # sidebar + panel tool layout, the same frame for every tool
  motion: 2                # snappy hovers and popovers only; prefers-reduced-motion honoured
  density: 7               # macOS-sized 13 px body, dense toolbars and monospace editors
fonts: "SF Pro (system) / SF Mono (system)"
accent: "#F5A524"
---

# DevKit design

## 1. The look

DevKit is an offline toolbox in a Tauri window: a warm-paper **sidebar** of 42 tools grouped by kind
(Formatters, Diff, Converters, Encoders, …) with a search field (⌘K), and a **content area** that is
either the "All tools" home — a header with the charcoal-and-amber app icon, "42 developer tools · 34
work offline", and grids of tool cards with soft amber icon tiles — or one tool: a slim header (icon,
name, one-line description, star / search / settings), a toolbar of segmented controls and plain
buttons, and big monospace editors. The palette comes from the icon: **charcoal** (`#161A23 →
#2C3445`) and **amber** (`#F5A524`), on warm off-white paper in light and blue-charcoal in dark. It is
a desktop tool, so it is dense and keyboard-driven — panels and editors, not marketing spacing.

Load-bearing ideas:

1. **Every value is a CSS custom property** in `src/index.css`; components use them, never raw hex.
2. **Amber is for selection and identity**, used sparingly: the selected sidebar row (amber-soft), icon
   tiles, the accent button. Text in amber uses `--accent-text` for contrast.
3. **macOS-sized type** (13 px body) and system fonts — offline, no web fonts.
4. **One tool frame** for all 42 tools: header, toolbar, panels.

## 2. Identity and references

- **DevToys**: the idea (a box of offline developer utilities, grouped sidebar). DevKit has its own
  name, icon (charcoal tile with an amber `</>` glyph), palette and copy; nothing from DevToys' look.
- macOS conventions inside a web view: system fonts, white switch knobs, ⌘K / ⌘D / ⌘, shortcuts.

## 3. Tokens

All in `src/index.css` (`:root` light, `.dark` dark, toggled by `ThemeProvider` on `<html>`).
Contrast notes in the file are against `--canvas`.

| Role | Light | Dark |
|---|---|---|
| `--canvas` / `--sidebar` / `--surface` | `#fbfaf7` / `#f1efe9` / `#ffffff` | `#161a23` / `#11141b` / `#1c212c` |
| `--surface-2` / `-3` | `#f6f4ef` / `#ebe8e1` | `#232937` / `#2c3445` |
| `--border` / `-strong` | `#e4e0d7` / `#cdc7bb` | `#2a3140` / `#3b4458` |
| `--text` / `-muted` / `-faint` | `#1e2430` 14.8:1 / `#525a69` 6.9:1 / `#6b7180` 4.7:1 | `#e8eaef` / `#a9afbc` / `#848b9c` |
| `--accent` / `-hover` / `--on-accent` | `#f5a524` / `#e8961a` / `#1e2430` (8.3:1) | `#f5a524` / `#ffb43d` / `#161a23` |
| `--accent-text` / `-soft` / `-ring` | `#9a5a00` 5.2:1 / `#fdf1dc` / amber 50 % | `#ffc861` 11:1 / amber 13 % / 55 % |
| Status | danger `#b4291f`, success `#1c7346`, info `#2a64a3` (+ `-soft`) | `#ff8a80`, `#63d297`, `#82b8ff` |
| Diff / syntax | `--diff-add/del(-strong)`, `--syn-key/string/number/keyword/comment/tag/punct` | dark variants |
| Type scale | `--text-2xs` 10.5 · xs 11 · sm 12 · **base 13** · md 14 · lg 16 · xl 20 · 2xl 26 (with line heights) | same |
| Radii | xs 4 · sm 6 · md 8 · lg 10 · xl 14 (concentric) | same |
| Effects | `--shadow-pop`, `--scrim`, `--knob` (white in both), `--ease-snappy` | dark variants |

## 4. Typography

`--font-sans` (SF Pro → Inter → system) at 13 px for UI; `--font-mono` (SF Mono → Menlo → JetBrains
Mono) for editors, code and values. Section labels small semibold muted with a count; tool names
semibold; descriptions `--text-muted`. Shortcut hints as small key caps.

## 5. Components

- `src/app/Sidebar.tsx` — search (⌘K), "All tools" with count, grouped tool rows with line icons,
  selected row on `--accent-soft`, footer: app name + System/Light/Dark segmented + settings.
- `src/app/Home.tsx` — header, pin hint (⌘D), Favorites grid first, grouped tool cards (icon tile, name,
  two-line description, star top-right: filled amber on favorites, outline on hover otherwise), "Find a tool" button.
- Favorites in the sidebar: a section above the categories; each row shows a star on hover (replacing the
  online globe). Dragging a favorite dims it and shows a 2 px amber drop line where it will land.
  Pressing ⌘ shows `⌘0` on "All tools" (in place of the count) and `⌘1`…`⌘9` key caps (`Kbd`) on the first nine
  favorites, in the sidebar and on Home cards.
- **Building blocks — every tool uses only `src/lib/ui`:** `TransformTool` (live input → output with
  modes), `EditorPane` (CodeMirror 6 + Paste/Clear/Copy + status line), `LookupBar` (online tools,
  Enter runs), `Panel`, `KeyValueList`, `Segmented`, `Toggle`, `Switch`, `Button`, `EmptyState`,
  `Notice`. Never hand-roll a variant inside a tool. Local tools update as you type; only online tools
  have a submit button. `ToolDef` needs a `description` and a lucide `icon`.
- Tool frame (per module in `src/tools/`, registered in `registry.ts`): header (icon tile, name,
  description, star, search, settings), toolbar (segmented controls, chip buttons like "Big numbers",
  "Schema", text buttons Sample / Open / Save / Copy / Compare…), panels with a small uppercase label
  ("DOCUMENT"), editors, status line ("Line: 1 Column: 1").
- `CommandPalette.tsx` (⌘K), `SettingsView.tsx` (a sheet, panes in app-shell order), `About.tsx` (mirrors
  app-shell's AboutView), `WhatsNew.tsx`; native menu in `src-tauri/src/menu.rs`; overlay title bar.

## 6. Layout and density

Window 1200 × 780 default, minimum 860 × 560 (`tauri.conf.json`). Sidebar ~244 px fixed; content
fills the rest; home cards in a 3-column grid that drops columns as the window narrows; at the
minimum width the tool toolbar wraps to two lines. Dense by design (dial 7).

## 7. Depth, materials, glass

Flat panels with 1 px borders; `--shadow-pop` only on popovers, menus and the command palette;
`--scrim` behind dialogs. No glass (web view).

## 8. Motion

Short transitions with `--ease-snappy` on hover/focus/popovers. `@media (prefers-reduced-motion:
reduce)` in `src/index.css` turns them off.

## 9. States

- Offline: online tools say they need the network and fail gracefully (`34 work offline` on home).
- `NotInApp`: system tools in a plain browser (`npm run dev`) show an explanation instead of crashing.
- Admin prompt cancelled → `"cancelled"`, no error shown.
- Empty editor: shows only line 1 (no hint text) — see gaps.
- Errors: status colours (`--danger` + `-soft`).

## 10. Do's and don'ts

- Do add a token to `index.css` (both `:root` and `.dark`) for any new colour/size; never raw hex in
  components.
- Do keep one tool = one module in `src/tools/registry.ts`, inside the shared tool frame.
- Do keep it offline: system fonts, no CDN assets.
- Don't use marketing-page spacing; DevKit is dense and keyboard-first.

**Allowed exceptions:**

- *Inter in the font stack*: a fallback after SF Pro for non-Mac platforms, not the face DevKit
  shows on macOS.

## 11. Render recipe

```bash
npm run dev                      # Vite on http://localhost:1420 (frontend only)
# from the scratchpad, not the repo:
playwright-cli -s=dk open http://localhost:1420
playwright-cli -s=dk resize 1200 780          # and 860 560 (minimum window)
playwright-cli -s=dk set-color-scheme light   # then dark
playwright-cli -s=dk screenshot --filename=<scratchpad>/devkit-<state>.png
playwright-cli -s=dk click "text=JSON Format >> nth=0"   # open a tool
playwright-cli -s=dk close
```

System tools need the native shell (`npm run tauri dev`); in the browser they show the NotInApp
explanation.

## 12. Known gaps

- JSON Format (svelte-jsoneditor, wrapped in `src/lib/jsoneditor/`, theme mapped in `jsoneditor.css`)
  still shows the library's own inner "text / tree / table" segment (dark-grey active state) right under
  DevKit's `Segmented` Text / Tree / Table: two mode switches, and the inner one doesn't look like
  `Segmented`.
- Empty editors have no hint text or "Sample" nudge inside the editor.
- Only Home and JSON Format were rendered in this pass; other tools not reviewed.
