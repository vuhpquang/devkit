#!/usr/bin/env bash
# scripts/release.sh — cut a DevKit (macOS) release end to end.
#
#   scripts/release.sh X.Y.Z notes.md             # push main + tag, GitHub release (Latest)
#   INSTALL=1 scripts/release.sh X.Y.Z notes.md   # also replace /Applications/devkit.app
#   PUBLISH=0 INSTALL=1 scripts/release.sh ...    # office: commit + tag locally, install, no push
#   DRY_RUN=1 scripts/release.sh X.Y.Z notes.md   # build + verify only, bump reverted
#   DRY_RUN=1 INSTALL=1 scripts/release.sh X.Y.Z  # preview: build + install to /Applications, nothing committed
#   SKIP_TESTS=1 ...                              # skip npm test + cargo test
#
# Steps: preflight → bump package.json/package-lock + tauri.conf.json + Cargo.toml/lock → tests →
# tauri build (.app, signed "DevKit Self-Signed" via bundle.macOS.signingIdentity) → verify signer
# against scripts/release-requirement.txt → zip → commit + tag → push + GitHub release → install.
# Afterwards publish to the App Depot catalog from the hub: scripts/depot-publish.sh devkit
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
die()  { echo "release: $*" >&2; exit 1; }
step() { echo; echo "==> $*"; }

REPO="vuhpquang/devkit"
BRANCH="main"
BUNDLE_ID="com.quangvu.devkit"   # never change: settings/storage are keyed by it
IDENTITY="DevKit Self-Signed"
PUBLISH="${PUBLISH:-1}"
DRY_RUN="${DRY_RUN:-0}"
BUILT_APP="src-tauri/target/release/bundle/macos/devkit.app"
APP="build/devkit.app"

VERSION="${1:-}"
NOTES_FILE="${2:-}"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "usage: scripts/release.sh X.Y.Z notes.md"
if [[ "$DRY_RUN" != "1" ]]; then  # a dry run / preview publishes nothing, so it needs no notes
    [[ -f "$NOTES_FILE" ]] || die "notes file not found: ${NOTES_FILE:-<missing>}"
    NOTES_FILE="$(cd "$(dirname "$NOTES_FILE")" && pwd)/$(basename "$NOTES_FILE")"
fi
TAG="v${VERSION}"
ZIP="build/DevKit-${VERSION}.zip"
EXPECTED_DR="$(head -n 1 scripts/release-requirement.txt)"

step "Preflight"
[[ "$(git branch --show-current)" == "$BRANCH" ]] || die "release from '$BRANCH'"
[[ -z "$(git status --porcelain)" ]] || die "working tree not clean"
git rev-parse -q --verify "refs/tags/$TAG" >/dev/null && die "tag $TAG already exists"
if [[ "$PUBLISH" != "0" && "$DRY_RUN" != "1" ]]; then
    gh auth status >/dev/null 2>&1 || die "gh is not logged in"
    # A push rejected after tagging would strand the local tag, so require main == origin/main up front.
    git fetch -q origin "$BRANCH" --tags
    git rev-parse -q --verify "refs/tags/$TAG" >/dev/null && die "tag $TAG already exists on origin"
    [[ "$(git rev-parse HEAD)" == "$(git rev-parse "origin/$BRANCH")" ]] \
        || die "$BRANCH is not in sync with origin/$BRANCH (pull or push first)"
fi
security find-identity -p codesigning | grep -q "\"$IDENTITY\"" \
    || die "signing identity '$IDENTITY' not in the keychain (scripts/make-signing-identity.sh, or import ~/.config/devkit-signing/devkit-signing.p12)"

CURRENT="$(node -p 'require("./package.json").version')"
newest="$(printf '%s\n%s\n' "$CURRENT" "$VERSION" | sort -t. -k1,1n -k2,2n -k3,3n | tail -1)"
[[ "$VERSION" != "$CURRENT" && "$newest" == "$VERSION" ]] || die "$VERSION must be newer than $CURRENT"
echo "    $CURRENT → $VERSION"

BUMPED=(package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock)
COMMITTED=0
undo() { if [[ "$DRY_RUN" == "1" || "$COMMITTED" == "0" ]]; then git checkout -q -- "${BUMPED[@]}"; fi; }
trap undo EXIT

step "Bumping version"
npm version "$VERSION" --no-git-tag-version --allow-same-version >/dev/null
node -e '
const fs = require("fs"), f = "src-tauri/tauri.conf.json";
const c = JSON.parse(fs.readFileSync(f, "utf8")); c.version = process.argv[1];
fs.writeFileSync(f, JSON.stringify(c, null, 2) + "\n");' "$VERSION"
# Only the [package] version (the first `version =` line), not dependency versions.
awk -v v="$VERSION" '!done && /^version = "/ { print "version = \"" v "\""; done=1; next } { print }' \
    src-tauri/Cargo.toml > src-tauri/Cargo.toml.tmp && mv src-tauri/Cargo.toml.tmp src-tauri/Cargo.toml

if [[ "${SKIP_TESTS:-0}" != "1" ]]; then
    step "Running tests"
    npm test >/dev/null 2>&1 || die "npm test failed"
    (cd src-tauri && cargo test -q >/dev/null 2>&1) || die "cargo test failed (run it in src-tauri/)"
    echo "    npm test + cargo test passed"
fi

step "Building (tauri build --bundles app)"
rm -rf "$BUILT_APP"
npm run -s tauri build -- --bundles app   # also rewrites Cargo.lock with the new version
mkdir -p build
rm -rf "$APP" "$ZIP"
ditto "$BUILT_APP" "$APP"

step "Verifying the release"
codesign --verify --deep --strict "$APP"
built="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Contents/Info.plist")"
[[ "$built" == "$VERSION" ]] || die "bundle says $built, expected $VERSION"
[[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Contents/Info.plist")" == "$BUNDLE_ID" ]] || die "wrong bundle id"
DR="$(codesign -d -r- "$APP" 2>&1 | sed -n 's/^designated => //p')"
[[ "$DR" == "$EXPECTED_DR" ]] || die "designated requirement differs from scripts/release-requirement.txt:
    got      $DR
    expected $EXPECTED_DR
installed copies (and the App Depot catalog signer) would reject this build"
[[ "$(lipo -archs "$APP/Contents/MacOS/devkit")" == *arm64* ]] || die "missing arm64 slice"
ditto -c -k --keepParent "$APP" "$ZIP"
echo "    signer OK ($IDENTITY), $ZIP sha256 $(shasum -a 256 "$ZIP" | awk '{print $1}')"

# Replaces the copy in /Applications with the build. Used by a real release and by a preview
# (DRY_RUN=1 INSTALL=1).
install_app() {
    step "Installing /Applications/devkit.app"
    INSTALLED_BIN="/Applications/devkit.app/Contents/MacOS/devkit"
    WAS_RUNNING=0
    if pgrep -fq "$INSTALLED_BIN"; then
        WAS_RUNNING=1
        osascript -e "quit app id \"$BUNDLE_ID\"" >/dev/null 2>&1 || true
        for _ in $(seq 1 20); do pgrep -fq "$INSTALLED_BIN" || break; sleep 0.5; done
        pgrep -fq "$INSTALLED_BIN" && die "installed DevKit is still running; quit it and run: ditto $APP /Applications/devkit.app"
    fi
    rm -rf /Applications/devkit.app
    ditto "$APP" /Applications/devkit.app
    touch /Applications/devkit.app
    /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f /Applications/devkit.app || true
    xattr -dr com.apple.quarantine /Applications/devkit.app 2>/dev/null || true
    [[ "$WAS_RUNNING" == "1" ]] && open /Applications/devkit.app
    return 0
}

if [[ "$DRY_RUN" == "1" ]]; then
    # DRY_RUN=1 INSTALL=1 = preview: the owner tries this build in /Applications before deciding to release.
    if [[ "${INSTALL:-0}" == "1" ]]; then install_app; step "Preview installed (version bump reverted, nothing committed)."; fi
    step "Dry run: stopping before commit; version bump reverted. Artifacts are in build/."
    exit 0
fi

step "Committing and tagging $TAG"
git add "${BUMPED[@]}"
MSG_FILE="$(mktemp)"
printf 'release: %s\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n' "$TAG" > "$MSG_FILE"
git commit -q -F "$MSG_FILE"
rm -f "$MSG_FILE"
COMMITTED=1
trap - EXIT
git tag -a "$TAG" -m "DevKit $VERSION"

if [[ "$PUBLISH" != "0" ]]; then
    step "Pushing and creating GitHub release $TAG"
    git push -q origin "$BRANCH" "$TAG"
    gh release create "$TAG" "$ZIP" -R "$REPO" --title "DevKit $VERSION" --notes-file "$NOTES_FILE" --latest
    echo "    https://github.com/$REPO/releases/tag/$TAG"
fi

if [[ "${INSTALL:-0}" == "1" ]]; then install_app; fi

step "Released DevKit $VERSION"
[[ "$PUBLISH" != "0" ]] || echo "    local only: commit + tag $TAG not pushed, no GitHub release yet"
echo "    Catalog: from the hub run  scripts/depot-publish.sh devkit"
exit 0
