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
