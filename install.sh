#!/bin/sh
# diffle installer — downloads the matching release binary, verifies its sha-256, and installs it
# to ~/.diffle/bin. Usage: curl -fsSL https://<host>/install | sh
set -eu

REPO="codywilliamson/diffle"
NAME="diffle"
BIN_DIR="${DIFFLE_INSTALL_DIR:-$HOME/.diffle/bin}"

fail() { echo "diffle install: $*" >&2; exit 1; }
for command in awk curl grep head install mkdir mktemp mv rm sed uname; do
  command -v "$command" >/dev/null 2>&1 || fail "required command not found: $command"
done

os="$(uname -s)"; arch="$(uname -m)"
case "$os" in Linux) OS=linux ;; Darwin) OS=darwin ;; *) fail "unsupported OS: $os" ;; esac
case "$arch" in x86_64|amd64) ARCH=x64 ;; arm64|aarch64) ARCH=arm64 ;; *) fail "unsupported architecture: $arch" ;; esac
ASSET="$NAME-$OS-$ARCH"

tmp="$(mktemp -d "${TMPDIR:-/tmp}/diffle-install.XXXXXX")"
staged=""
cleanup() {
  [ -z "$staged" ] || rm -f "$staged"
  rm -rf "$tmp"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' HUP TERM

download() {
  url="$1"; output="$2"; label="$3"
  if ! curl -fL --silent --show-error "$url" -o "$output" 2>/dev/null; then
    fail "failed to download $label"
  fi
}

release_json="$tmp/release.json"
download "https://api.github.com/repos/$REPO/releases/latest" "$release_json" "latest GitHub release metadata"
TAG="$(sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' "$release_json" | head -n1)"
[ -n "$TAG" ] || fail "latest GitHub release has no tag"
case "$TAG" in *[!A-Za-z0-9._-]*) fail "latest GitHub release has an invalid tag" ;; esac

asset_names="$(sed -n 's/^[[:space:]]*"name":[[:space:]]*"\([^"]*\)".*/\1/p' "$release_json")"
printf '%s\n' "$asset_names" | grep -Fqx "$ASSET" || fail "latest release $TAG is missing required asset: $ASSET; no compatible diffle release is available yet"
printf '%s\n' "$asset_names" | grep -Fqx 'checksums.txt' || fail "latest release $TAG is missing required asset: checksums.txt; no compatible diffle release is available yet"

BASE="https://github.com/$REPO/releases/download/$TAG"
echo "downloading $ASSET ($TAG)..."
download "$BASE/checksums.txt" "$tmp/checksums.txt" "checksums.txt for $TAG"
download "$BASE/$ASSET" "$tmp/$ASSET" "$ASSET for $TAG"

expected="$(awk -v a="$ASSET" 'length($1)==64 && $1 !~ /[^0-9a-fA-F]/ && ($2==a || $2=="*"a) {print tolower($1); exit}' "$tmp/checksums.txt")"
[ -n "$expected" ] || fail "no valid checksum published for $ASSET"
if command -v sha256sum >/dev/null 2>&1; then
  actual="$(sha256sum "$tmp/$ASSET" | awk '{print tolower($1)}')"
elif command -v shasum >/dev/null 2>&1; then
  actual="$(shasum -a 256 "$tmp/$ASSET" | awk '{print tolower($1)}')"
else
  fail "required checksum command not found: sha256sum or shasum"
fi
[ "$actual" = "$expected" ] || fail "checksum mismatch for $ASSET"

mkdir -p "$BIN_DIR"
staged="$BIN_DIR/.$NAME.new-$$"
install -m 0755 "$tmp/$ASSET" "$staged"
mv -f "$staged" "$BIN_DIR/$NAME"
staged=""

echo "installed $NAME $TAG to $BIN_DIR/$NAME"
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo "add it to your PATH:  export PATH=\"$BIN_DIR:\$PATH\"" ;;
esac
