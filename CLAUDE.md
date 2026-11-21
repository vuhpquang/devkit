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

## UI

- Palette comes from the app icon: charcoal (`#161A23`→`#2C3445`) + amber (`#F5A524`/`#FFC861`). Every colour,
  type size and radius is a token in `src/index.css` (`:root` / `.dark`, exposed to Tailwind as `bg-surface`,
  `text-fg-muted`, `bg-accent`, …). No raw hex or `zinc-*` in components; a new value = a new token.
  Amber is a fill (primary buttons, charcoal text on it); amber *text* uses `text-accent-text`.
- Fonts are the system ones (SF Pro / SF Mono, offline). Body 13 px, editors 13 px mono.
- Every tool builds from `src/lib/ui` only: `TransformTool` (live input → output with modes, used by the
  formatters/converters/encoders), `EditorPane` (CodeMirror 6 + Paste/Clear/Copy + status line), `LookupBar`
  (online tools, Enter runs), `Panel`, `KeyValueList`, `Segmented`, `Button`, `EmptyState`, `Notice`.
  Local tools update as you type; only online tools have a submit button.
- `ToolDef` needs `description` and a lucide `icon`; they show in the header, home grid, sidebar and ⌘K.
- Shell: `src/app/` — Sidebar (search, Favorites, categories), Home grid, ⌘K palette (arrows, recent),
  ⌘D toggles favorite. Stored in localStorage: `devkit.theme`, `devkit.lastTool`, `devkit.favorites`,
  `devkit.recent` (never rename them).
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
