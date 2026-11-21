# DevKit — Roadmap

DevToys-style developer utility app, **offline-first**. Tauri 2 + React + TypeScript.
v1 is fully local; v1.5 adds online tools via free, keyless APIs.

Design spec: `../../docs/superpowers/specs/2026-06-22-devkit-design.md`

## v1 — Foundation (current scope)

App shell + 14 tools, fully offline.

**Shell**
- [ ] Tauri 2 + React + Vite + TypeScript + Tailwind scaffold
- [ ] Tool registry pattern (`ToolDef` + `registry.ts`)
- [ ] Sidebar with category grouping + search
- [ ] Cmd+K command palette
- [ ] System/light/dark theme with manual toggle + persistence
- [ ] Shared UX components (copy / paste / clear, editor wrapper, error panel)

**Tools**
- [ ] Formatters: JSON, SQL, XML
- [ ] Diff: JSON diff, Text/file diff (with native file open via Rust)
- [ ] Converters: JSON ↔ YAML, Timestamp, Number base
- [ ] Encoders: Base64, URL, JWT decode
- [ ] Generators: Hash, UUID, Lorem ipsum

**Quality**
- [ ] Vitest unit tests for every tool's `logic.ts`
- [ ] Shell smoke tests (registry, palette)

## v1.5 — Online Tools

Network-backed tools using free, keyless APIs. Each shows an "online" badge and
degrades gracefully (inline error on offline/timeout/rate-limit).

- [ ] **Networking foundation** — Tauri HTTP plugin + pinned allowed-hosts capability
- [ ] **DNS lookup** — A/AAAA/MX/TXT/CNAME via Cloudflare DNS-over-HTTPS
- [ ] **IP info** — geo/ASN/org via ip-api.com
- [ ] **WHOIS** — Rust TCP command (port 43), IANA → registrar referral
- [ ] **Live currency conversion** — open.er-api.com rates (non-currency units stay local math)
- [ ] **Package version (npm/Yarn)** — latest + version list from registry.npmjs.org
- [ ] "Online" badge in sidebar/palette + offline-state handling

## v2 — Polish & Convenience

- [ ] **Clipboard smart-detection** — detect clipboard content type, suggest matching tool
- [x] **Settings** — theme, sidebar mode, startup, hide/show tools, online tools off, editor font size/wrap/line numbers, updates
- [ ] **Input history** per tool (opt-in, local only)
- [x] **Keyboard shortcuts**: ⌘K palette with arrow keys, ⌘D favorite, Enter runs online lookups
- [x] **Favorites / pinned tools** at top of sidebar (+ recent tools in ⌘K)
- [x] **UI revamp**: icon-palette tokens, system fonts, CodeMirror editors, live output, home grid, overlay title bar
- [ ] Auto-update via Tauri updater

## v3 — Expand the Toolbox

Additional DevToys-class tools:
- [x] Color picker / converter (HEX ↔ RGB ↔ HSL)
- [x] Regex tester with match highlighting
- [x] Markdown preview
- [x] Cron expression parser
- [x] JSON ↔ CSV
- [ ] Certificate decoder (X.509)
- [ ] QR code generator
- [x] Text case converter (line sort/dedupe still open)
- [ ] Image Base64 encode/decode
- [ ] Hash file (not just text)

## v4 — Extensibility

- [ ] **Plugin system** — third-party tools dropped into the registry at runtime
- [ ] Per-tool deep links / CLI invocation
- [ ] Localization (i18n) framework

## Non-Goals

- **No accounts and no telemetry.** Online tools (v1.5+) only call public APIs to
  perform the user's explicit lookup — nothing is reported back about usage.
- v1 tools stay fully local; online tools are clearly badged and isolated.
- No cloud sync of inputs/history.
- Prefer free, keyless APIs. Paid/keyed providers only as opt-in via settings (v2+).
