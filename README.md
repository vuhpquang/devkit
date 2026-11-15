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
    app/            # shell: sidebar, command palette, theme
    tools/          # one folder per tool (logic.ts + index.tsx + tests)
      registry.ts   # aggregates all tools into ToolDef[]
    lib/            # shared UI primitives
```

Each tool is self-contained and registered in `src/tools/registry.ts`. Adding a tool =
create a folder exporting a `ToolDef` and append one import + `tools.push(...)` line.

---

© 2026 Ha Phung Quang Vu · [vuhpquang.com](https://vuhpquang.com) · [GitHub](https://github.com/vuhpquang) · [LinkedIn](https://www.linkedin.com/in/vuhpquang/)
