# DevKit

A DevToys-style **offline-first** desktop utility app for developers. Built with
Tauri 2 + React + TypeScript. v1 ships 14 local tools (formatters, diff, converters,
encoders, generators); v1.5 adds online tools via free, keyless APIs.

- Design spec: [`../../docs/superpowers/specs/2026-06-22-devkit-design.md`](../../docs/superpowers/specs/2026-06-22-devkit-design.md)
- Implementation plan: [`../../docs/superpowers/plans/2026-06-22-devkit-v1.md`](../../docs/superpowers/plans/2026-06-22-devkit-v1.md)
- Roadmap: [`PLAN.md`](PLAN.md)

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| **Node.js** ≥ 18 (22 recommended) | runs the React/Vite frontend |
| **npm** | package manager |
| **Rust** (stable) + Cargo | required by Tauri — install via [rustup](https://rustup.rs) |
| **Platform deps** | macOS: Xcode Command Line Tools. Linux/Windows: see [Tauri prerequisites](https://tauri.app/start/prerequisites/) |

Install Rust if you don't have it:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
rustc --version && cargo --version
```

## Setup

```bash
cd projects/devkit
npm install
```

## Run (development)

Launches the Tauri desktop window with hot-reloading frontend:

```bash
npm run tauri dev
```

To run only the web frontend in a browser (no native shell — useful for quick UI work):

```bash
npm run dev
```

## Build (production)

Produces a native installer/bundle for your current platform:

```bash
npm run tauri build
```

Output bundles are written to `src-tauri/target/release/bundle/` (e.g. `.dmg`/`.app`
on macOS, `.msi`/`.exe` on Windows, `.deb`/`.AppImage` on Linux).

## Release (macOS)

`INSTALL=1 scripts/release.sh X.Y.Z notes.md` builds a signed `DevKit-X.Y.Z.zip` and publishes it as a
GitHub release; DevKit installs and updates through App Depot. Details in [`CLAUDE.md`](CLAUDE.md).

## Test

Unit tests (Vitest) cover every tool's pure logic:

```bash
npm test            # run once
npm run test:watch  # watch mode
```

Type-check and frontend build:

```bash
npx tsc --noEmit && npm run build
```

## Project structure

```
projects/devkit/
  src-tauri/        # Rust shell + native commands (file dialogs)
  src/
    app/            # shell: sidebar, home grid, ⌘K palette, theme, favorites/recent
    tools/          # one folder per tool (logic.ts + index.tsx + tests)
      registry.ts   # aggregates all tools into ToolDef[]
    lib/ui/         # design system: tokens live in src/index.css; Button, Segmented,
                    # EditorPane (CodeMirror 6), TransformTool, LookupBar, Panel, …
```

Each tool is self-contained and registered in `src/tools/registry.ts`. Adding a tool =
create a folder exporting a `ToolDef` (with a `description` and a lucide `icon`), build its
screen from `src/lib/ui`, and append one import + `tools.push(...)` line.

## Tools

Formatters (JSON Format — svelte-jsoneditor: text/tree/table, repair, sort, transform with JSONQuery/JMESPath/JSONPath/Lodash/JavaScript, JSON Schema validation, big numbers — SQL, XML) · Diff (JSON side by side with highlighted differences and a change list, text/file) ·
Converters (SVG ↔ React / React Native, JSON ↔ YAML, JS object → JSON, JSON ↔ CSV, timestamp, number base, cron, chmod) · Encoders (Base64,
URL, URL parser, HTML entities, JWT) · Generators (hash, UUID, password, lorem ipsum) · Text (regex tester, case
converter, Markdown preview) · Design (colour converter, PNG tint tester, image converter SVG/PNG/JPEG/WebP/GIF/BMP/TIFF/ICO, batch image resize) · System, macOS (network info, port
inspector, DNS switcher with Google / Cloudflare / DNSPod / custom presets, network throttle slow / medium / fast,
/etc/hosts editor) · Network, online (WHOIS, DNS lookup, IP info, npm, currency, GitLab pipelines & merge requests,
ping & traceroute, speed test).

## Using it

- **⌥Space** from any app opens a small launcher: type, pick a tool with the arrows, Enter (can be turned off in
  Settings → General).
- **⌘K** jumps to any tool (arrow keys + Enter): what you copied first (JSON, a JWT, a timestamp, Base64… open
  straight in the right tool), then favorites and recent tools.
- **Favorites**: star a tool (the star on hover, right-click, or **⌘D**), drag it onto Favorites, drag to reorder.
  **⌘1…⌘9** open them (press **⌘** to see the numbers), **⌘0** goes to All tools, **⌃Tab** cycles them.
- **⌘[ / ⌘]** back and forward through the tools you opened; switching keeps what you typed in the last six.
- **⌘/** lists every shortcut.
- **⌘,** Settings: hide tools you don't use, switch online tools off, editor font size, sidebar shown / hidden /
  auto-hide (**⌘E** toggles it; ⌃⌘S also works).
- Local tools update as you type; **Sample** loads an example. Online tools run on **Enter**.
- Light, dark or follow the system: the switch at the bottom of the sidebar.

## License

MIT. See [LICENSE](LICENSE).

---

© 2026 Ha Phung Quang Vu · [vuhpquang.com](https://vuhpquang.com) · [GitHub](https://github.com/vuhpquang) · [LinkedIn](https://www.linkedin.com/in/vuhpquang/)
