# DevKit

Offline-first developer utilities (DevToys-style). Tauri 2 shell (`src-tauri/`, Rust) + React/TypeScript
frontend (`src/`). Public repo `vuhpquang/devkit`, branch `main`. Setup, structure and tool layout: `README.md`;
roadmap: `PLAN.md`.

## Commands

- `npm run dev` (frontend only) · `npm run tauri dev` (native shell)
- Tests: `npm test` (vitest) and `cargo test` in `src-tauri/`; type-check `npx tsc --noEmit`
- Local bundle: `npm run tauri build -- --bundles app` → `src-tauri/target/release/bundle/macos/devkit.app`

## Rules

- One tool = one module registered in `src/tools/registry.ts`; the registry integration test lists them all.
- Online tools use free, keyless APIs and fail gracefully offline. Every host they call must be in the
  `http:default` `allow` list in `src-tauri/capabilities/default.json` (not in `tauri.conf.json` `plugins.http`:
  tauri-plugin-http 2.5 panics at launch on a scope there).
- Bundle id `com.quangvu.devkit` never changes (settings and the App Depot entry are keyed by it).

## System tools (macOS)

Network Info, Port Inspector, DNS Switcher, Network Throttle, Hosts File and Ping & Traceroute call Rust commands
in `src-tauri/src/sys/` through the typed wrappers in `src/lib/system.ts` (they reject with `NotInApp` in a plain
browser, so `npm run dev` shows an explanation instead of crashing).

- Unprivileged commands: `sys::run` with an absolute program path and an argument list — never a shell.
- Root work (DNS, throttle, hosts): `sys::privileged` runs a `/bin/sh` script through the macOS administrator
  prompt. Scripts are built only from constants and values already validated into narrow types (parsed IPs,
  integers in range, a network service name `networksetup` itself listed, paths DevKit generated), each one
  `sh_quote`d. Never interpolate anything else. Cancelling the prompt → `"cancelled"` (`isCancelled`) → no error.
- Network Throttle (`sys/throttle.rs`): dummynet pipes 7101/7102 + pf anchor `com.apple/devkit` (the stock
  `/etc/pf.conf` has `dummynet-anchor "com.apple/*"`), loopback excluded, pf enabled with a token and released
  with it. A root watcher undoes everything when `$TMPDIR/devkit-throttle/off` appears (Turn off — no password),
  DevKit's PID exits, or the time limit passes. `cargo test` checks the rules with `pfctl -n`; the real effect needs
  the admin password, so verify by hand after changing it.
- Hosts: saved through a temp file; the old file is kept as `/etc/hosts.devkit-backup`; DNS cache flushed.
- Images (`src-tauri/src/img.rs`, binding `src/lib/image.ts`): decode PNG/JPEG/WebP/GIF/BMP/TIFF/ICO and SVG
  (resvg), resize (fit/fill/exact/percent, no upscaling of rasters unless asked), encode PNG/JPEG/WebP (lossy via
  libwebp, lossless)/GIF/BMP/TIFF/multi-size ICO. Bytes travel as a raw IPC body, options in the `x-devkit-options`
  header, the response is `u32 width, u32 height` (LE) + the file. WebKit can't encode WebP, hence Rust.
- Tool → tool hand-off: `sendTo(id, payload)` / `takeHandoff(id)` (`src/app/handoff.ts`); the shell opens and
  remounts the target. SVG ↔ React → Image Converter → Image Resize use it.
- HTTP scope additions: `api.github.com` (updates), `speed.cloudflare.com` (Speed Test), `https://*/api/v4/*` +
  `http://localhost:*/api/v4/*` (GitLab, token in the `PRIVATE-TOKEN` header).

## UI

- Palette comes from the app icon: charcoal (`#161A23`→`#2C3445`) + amber (`#F5A524`/`#FFC861`). Every colour,
  type size and radius is a token in `src/index.css` (`:root` / `.dark`, exposed to Tailwind as `bg-surface`,
  `text-fg-muted`, `bg-accent`, …). No raw hex or `zinc-*` in components; a new value = a new token.
  Amber is a fill (primary buttons, charcoal text on it); amber *text* uses `text-accent-text`.
- Fonts are the system ones (SF Pro / SF Mono, offline). Body 13 px, editors 13 px mono.
- Every tool builds from `src/lib/ui` only: `TransformTool` (live input → output with modes, used by the
  formatters/converters/encoders), `EditorPane` (CodeMirror 6 + Paste/Clear/Copy + status line), `LookupBar`
  (online tools, Enter runs), `Panel`, `KeyValueList`, `Segmented`, `Toggle` (pressed buttons: flags, record
  types, bits), `Switch`, `Button`, `EmptyState`, `Notice`. Don't hand-roll a variant of one of these in a tool.
  Local tools update as you type; only online tools have a submit button.
- `ToolDef` needs `description` and a lucide `icon`; they show in the header, home grid, sidebar and ⌘K.
- Shell: `src/app/` — Sidebar (search, Favorites, categories; modes Shown / Hidden / Auto-hide, toggle ⌃⌘S),
  Home grid, ⌘K palette (arrows, recent; hidden tools still found), ⌘D toggles favorite.
- Settings (⌘,) is a sheet in the window (`SettingsView.tsx`), panes in app-shell order: General, Tools
  (show/hide each tool, online tools off = no network), Editor (font size, wrap, line numbers → `EditorDefaults`
  context in `lib/ui`), Updates, About. Model + validation: `settings.ts` (`parseSettings` drops bad fields).
- About follows app-shell's AboutView exactly (`About.tsx`: icon 112, name, tagline, `Version X (build)` — build =
  commit count from `vite.config.ts` — update status + button, What's New / Report Issue, author footer, 420 wide).
  Updates: `updater.tsx` checks GitHub `releases/latest` 10 s after launch and every 6 h (auto-check setting); App
  Depot installs, so the button opens the release page. What's New (`WhatsNew.tsx`) opens once after the version
  goes up, silent on first run (`devkit.whatsNew.lastVersion`).
- Native menu: `src-tauri/src/menu.rs` (About, Check for Updates…, Settings… ⌘,, Find a Tool ⌘K, Toggle Sidebar
  ⌃⌘S, What's New, Report an Issue; Edit menu kept so ⌘C/⌘V work in the webview). Items reach the page as a `menu`
  event (`src/app/menuEvents.ts`); inside the app the page doesn't also handle ⌘K / ⌘, / ⌃⌘S.
- localStorage keys (never rename): `devkit.theme`, `devkit.lastTool`, `devkit.favorites`, `devkit.recent`,
  `devkit.settings`, `devkit.whatsNew.lastVersion`, `devkit.jsonEditor.split`, `devkit.gitlab` (token stays on
  this Mac).
- DevKit is a **public** repo: tools ported from the owner's work scripts (GitLab dashboard) carry no company
  hosts, user names or group names — the user types them in the app.
- Window: overlay title bar (`titleBarStyle: Overlay`, traffic lights at 18,24). The 52 px strip at the top of the
  sidebar and the tool header carry `data-tauri-drag-region` (needs `core:window:allow-start-dragging`).
- Look at it before calling UI done: `npm run dev`, then light + dark at 1200×780 (Playwright works against
  `localhost:1420`); the native title bar only shows in the `.app`.

## Release

```bash
INSTALL=1 scripts/release.sh X.Y.Z notes.md    # home: push main + tag, GitHub release (Latest), install
PUBLISH=0 INSTALL=1 scripts/release.sh X.Y.Z notes.md   # office: commit + tag locally, install
DRY_RUN=1 scripts/release.sh X.Y.Z notes.md    # build + verify only
```

It bumps `package.json`/`package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`/`Cargo.lock`,
runs `npm test` + `cargo test`, builds the `.app`, verifies the signature and designated requirement, zips
`build/DevKit-X.Y.Z.zip`, commits `release: vX.Y.Z`, tags, pushes and creates the GitHub release.
Notes are user-facing (`## What's new` / `## Fixes`).

Then from the hub root: `scripts/depot-publish.sh devkit` (must print `published`).

## Signing and updates

- Signed with the self-signed **DevKit Self-Signed** identity (`bundle.macOS.signingIdentity` in
  `tauri.conf.json`). Created once by `scripts/make-signing-identity.sh`; backup in `~/.config/devkit-signing/`
  (never commit it, never print the password). New Mac: import the `.p12` from there.
- `scripts/release-requirement.txt` pins the designated requirement. The release fails if a build doesn't match:
  installed copies and the App Depot catalog `signer` would reject it. Losing the identity = installed
  copies can't be updated in place.
- There is no in-app updater. **App Depot** (macOS) installs and updates DevKit from the GitHub release asset
  (`installMode: managed`, hub `docs/app-depot-apps.json`, slug `devkit`).
