#!/bin/sh
# diffle installer — downloads the matching release binary, verifies its sha-256, and installs it
# to ~/.diffle/bin. Usage:  curl -fsSL https://<host>/install | sh
set -eu

REPO="codywilliamson/loupe"   # repo not yet renamed; GitHub redirects the old path afterwards
NAME="diffle"
BIN_DIR="${DIFFLE_INSTALL_DIR:-$HOME/.diffle/bin}"

os="$(uname -s)"; arch="$(uname -m)"
case "$os" in Linux) OS=linux ;; Darwin) OS=darwin ;; *) echo "unsupported OS: $os" >&2; exit 1 ;; esac
case "$arch" in x86_64|amd64) ARCH=x64 ;; arm64|aarch64) ARCH=arm64 ;; *) echo "unsupported arch: $arch" >&2; exit 1 ;; esac
ASSET="$NAME-$OS-$ARCH"

TAG="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
  | sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
[ -n "$TAG" ] || { echo "could not resolve the latest release" >&2; exit 1; }
BASE="https://github.com/$REPO/releases/download/$TAG"

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
echo "downloading $ASSET ($TAG)…"
curl -fsSL "$BASE/$ASSET" -o "$tmp/$ASSET"
curl -fsSL "$BASE/checksums.txt" -o "$tmp/checksums.txt"

expected="$(awk -v a="$ASSET" '$2==a || $2=="*"a {print $1}' "$tmp/checksums.txt" | head -n1)"
[ -n "$expected" ] || { echo "no checksum published for $ASSET" >&2; exit 1; }
if command -v sha256sum >/dev/null 2>&1; then actual="$(sha256sum "$tmp/$ASSET" | awk '{print $1}')"
else actual="$(shasum -a 256 "$tmp/$ASSET" | awk '{print $1}')"; fi
[ "$actual" = "$expected" ] || { echo "checksum mismatch for $ASSET" >&2; exit 1; }

mkdir -p "$BIN_DIR"
install -m 0755 "$tmp/$ASSET" "$BIN_DIR/$NAME"
echo "installed $NAME $TAG to $BIN_DIR/$NAME"
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo "add it to your PATH:  export PATH=\"$BIN_DIR:\$PATH\"" ;;
esac
