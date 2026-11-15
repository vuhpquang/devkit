#!/usr/bin/env bash
# One-time: creates the "DevKit Self-Signed" code-signing identity in the login keychain and backs it
# up to ~/.config/devkit-signing/ (copy of ZenTask's script). Never commit that folder, never
# print the password. Lose it and installed copies can't update themselves (they pin this certificate).
set -euo pipefail
die()  { echo "error: $*" >&2; exit 1; }
step() { echo; echo "==> $*"; }

NAME="DevKit Self-Signed"
DIR="$HOME/.config/devkit-signing"
P12="$DIR/devkit-signing.p12"
OPENSSL=/usr/bin/openssl   # LibreSSL: its .p12 (3DES/SHA1) is what `security import` accepts

security find-identity -p codesigning | grep -q "\"$NAME\"" && die "'$NAME' already exists in the keychain"
[[ -e "$P12" ]] && die "$P12 exists; import it instead of creating a new identity:
    security import \"$P12\" -k ~/Library/Keychains/login.keychain-db -P \"\$(cat $DIR/p12-password.txt)\" -T /usr/bin/codesign"

mkdir -p "$DIR" && chmod 700 "$DIR"
cat > "$DIR/cert.cnf" <<CNF
[req]
distinguished_name = dn
x509_extensions = ext
prompt = no
[dn]
CN = $NAME
[ext]
basicConstraints = critical,CA:false
keyUsage = critical,digitalSignature
extendedKeyUsage = critical,codeSigning
CNF

step "Creating certificate"
"$OPENSSL" req -x509 -newkey rsa:2048 -days 3650 -nodes -config "$DIR/cert.cnf" \
    -keyout "$DIR/key.pem" -out "$DIR/cert.pem" 2>/dev/null
PASS="$("$OPENSSL" rand -base64 24)"
printf '%s' "$PASS" > "$DIR/p12-password.txt"
"$OPENSSL" pkcs12 -export -inkey "$DIR/key.pem" -in "$DIR/cert.pem" -name "$NAME" \
    -out "$P12" -passout "pass:$PASS"
rm -f "$DIR/key.pem"
chmod 600 "$DIR"/*

step "Importing into the login keychain"
security import "$P12" -k "$HOME/Library/Keychains/login.keychain-db" \
    -P "$PASS" -T /usr/bin/codesign >/dev/null

SHA1="$("$OPENSSL" x509 -in "$DIR/cert.pem" -noout -fingerprint -sha1 | sed 's/.*=//; s/://g' | tr 'A-F' 'a-f')"
echo "    identity: $NAME"
echo "    sha1:     $SHA1   (release.sh pins the designated requirement in scripts/release-requirement.txt)"
