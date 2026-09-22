#!/bin/sh
# diffle installer — downloads the matching release binary, verifies its sha-256, installs it to
# ~/.diffle/bin, and persists that directory on PATH via a marker block in your shell rc.
# Usage: curl -fsSL https://<host>/install | sh   (uninstall: sh install.sh --uninstall)
# Env: DIFFLE_INSTALL_DIR, DIFFLE_NO_MODIFY_PATH, DIFFLE_DRY_RUN, DIFFLE_UNINSTALL, NO_COLOR
set -eu

REPO="codywilliamson/diffle"
NAME="diffle"
BIN_DIR="${DIFFLE_INSTALL_DIR:-$HOME/.diffle/bin}"
MARKER_START="# >>> diffle >>>"
MARKER_END="# <<< diffle <<<"
RULE="=================================================="
BLANK="                                                                      "
BG_PID=""
staged=""
tmp=""

IS_TTY=0
if [ -t 1 ]; then IS_TTY=1; fi
C_RESET=""; C_DIM=""; C_GREEN=""; C_YELLOW=""; C_WARN=""; C_RED=""; C_BOLD=""
if [ "$IS_TTY" = 1 ] && [ -z "${NO_COLOR:-}" ] && [ "${TERM:-}" != dumb ]; then
  esc="$(printf '\033')"
  C_RESET="$esc[0m"; C_DIM="$esc[2m"; C_GREEN="$esc[32m"; C_YELLOW="$esc[33m"
  C_WARN="$esc[1;33m"; C_RED="$esc[31m"; C_BOLD="$esc[1m"
fi

log() {
  log_level="$1"; shift
  case "$log_level" in
    INFO) log_color="$C_DIM" ;;
    WAIT) log_color="$C_YELLOW" ;;
    OK) log_color="$C_GREEN" ;;
    WARN) log_color="$C_WARN" ;;
    *) log_color="$C_RED" ;;
  esac
  case "$log_level" in
    WARN|ERROR) printf '[%s] [%s%s%s] %s\n' "$(date +%H:%M:%S)" "$log_color" "$log_level" "$C_RESET" "$*" >&2 ;;
    *) printf '[%s] [%s%s%s] %s\n' "$(date +%H:%M:%S)" "$log_color" "$log_level" "$C_RESET" "$*" ;;
  esac
}

section() { printf '%s%s%s\n%s%s%s\n' "$C_DIM" "$RULE" "$C_RESET" "$C_BOLD" "$1" "$C_RESET"; }

fail() { printf '%sdiffle install: %s%s\n' "$C_RED" "$*" "$C_RESET" >&2; exit 1; }

for dep in awk cat cp curl date grep head install mkdir mktemp mv rm sed sleep uname; do
  command -v "$dep" >/dev/null 2>&1 || fail "required command not found: $dep"
done

# --- shell rc resolution ------------------------------------------------------------------------

resolve_rc() {
  SHELL_NAME="${SHELL:-}"; SHELL_NAME="${SHELL_NAME##*/}"
  RC_KIND=posix
  case "$SHELL_NAME" in
    zsh) RC_FILE="${ZDOTDIR:-$HOME}/.zshrc" ;;
    bash) RC_FILE="$HOME/.bashrc" ;;
    fish) RC_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/fish/config.fish"; RC_KIND=fish ;;
    *) RC_FILE="$HOME/.profile" ;;
  esac
}

append_block() {
  append_rc="$1"; append_body="$2"
  mkdir -p "${append_rc%/*}"
  if [ -f "$append_rc" ]; then
    append_backup="$append_rc.diffle.bak-$(date +%Y%m%d-%H%M%S)"
    cp "$append_rc" "$append_backup"
    log INFO "backed up $append_rc to $append_backup"
  fi
  {
    printf '\n%s\n' "$MARKER_START"
    printf '%s\n' "$append_body"
    printf '%s\n' "$MARKER_END"
  } >> "$append_rc"
}

# drops the marker block plus the single blank line we inserted above it, so the rest of the file
# stays byte-identical to what it was before the install
strip_block() {
  strip_rc="$1"
  [ -f "$strip_rc" ] || return 0
  grep -qF "$MARKER_START" "$strip_rc" || return 0
  strip_tmp="$strip_rc.diffle.tmp.$$"
  awk -v s="$MARKER_START" -v e="$MARKER_END" '
    function flush_blanks(  i) { for (i = 0; i < held; i++) print ""; held = 0 }
    BEGIN { held = 0; skip = 0 }
    skip { if ($0 == e) skip = 0; next }
    $0 == s { if (held > 0) held--; flush_blanks(); skip = 1; next }
    $0 == "" { held++; next }
    { flush_blanks(); print }
    END { flush_blanks() }
  ' "$strip_rc" > "$strip_tmp"
  mv -f "$strip_tmp" "$strip_rc"
  log OK "removed the diffle PATH block from $strip_rc"
}

manual_path_line() {
  if [ "$RC_KIND" = fish ]; then
    log INFO "add it to your PATH:  fish_add_path \"$BIN_DIR\""
  else
    log INFO "add it to your PATH:  export PATH=\"$BIN_DIR:\$PATH\""
  fi
}

# macOS bash login shells read .bash_profile, not .bashrc
ensure_bash_profile() {
  if [ "$SHELL_NAME" != bash ] || [ "${OS:-}" != darwin ]; then return 0; fi
  bash_profile="$HOME/.bash_profile"
  if [ -f "$bash_profile" ] && grep -qF '.bashrc' "$bash_profile"; then
    log INFO "$bash_profile already sources .bashrc; no change"
    return 0
  fi
  if [ -n "${DIFFLE_DRY_RUN:-}" ]; then
    log WAIT "dry run: would make $bash_profile source .bashrc"
    return 0
  fi
  append_block "$bash_profile" '[ -f "$HOME/.bashrc" ] && . "$HOME/.bashrc"'
  log OK "made $bash_profile source .bashrc"
}

activation_hint() {
  if [ "$RC_KIND" = fish ]; then
    log INFO "activate now:  source $RC_FILE   (new shells pick it up automatically)"
  else
    log INFO "activate now:  exec \$SHELL -l   (or: . $RC_FILE) — new shells pick it up automatically"
  fi
}

configure_path() {
  section "PATH"
  resolve_rc
  if [ -n "${DIFFLE_NO_MODIFY_PATH:-}" ]; then
    log INFO "DIFFLE_NO_MODIFY_PATH is set; leaving $RC_FILE untouched"
    manual_path_line
    return 0
  fi
  case ":$PATH:" in
    *":$BIN_DIR:"*) log INFO "$BIN_DIR already on PATH; no change"; return 0 ;;
  esac
  if [ -f "$RC_FILE" ] && grep -qF "$MARKER_START" "$RC_FILE"; then
    log INFO "already configured in $RC_FILE; no change"
    ensure_bash_profile
    activation_hint
    return 0
  fi
  if [ "$RC_KIND" = fish ]; then
    path_body="fish_add_path \"$BIN_DIR\""
  else
    path_body="export PATH=\"$BIN_DIR:\$PATH\""
  fi
  if [ -n "${DIFFLE_DRY_RUN:-}" ]; then
    log WAIT "dry run: would append the diffle PATH block to $RC_FILE"
    log INFO "  $path_body"
    ensure_bash_profile
    return 0
  fi
  append_block "$RC_FILE" "$path_body"
  log OK "added $BIN_DIR to PATH in $RC_FILE"
  ensure_bash_profile
  activation_hint
}

uninstall_diffle() {
  section "Uninstall"
  resolve_rc
  if [ -n "${DIFFLE_DRY_RUN:-}" ]; then
    log WAIT "dry run: would remove the diffle PATH block and $BIN_DIR/$NAME"
    return 0
  fi
  for rc_candidate in "${ZDOTDIR:-$HOME}/.zshrc" "$HOME/.bashrc" "$HOME/.bash_profile" \
    "$HOME/.profile" "${XDG_CONFIG_HOME:-$HOME/.config}/fish/config.fish"; do
    strip_block "$rc_candidate"
  done
  if [ -f "$BIN_DIR/$NAME" ]; then
    rm -f "$BIN_DIR/$NAME"
    log OK "removed $BIN_DIR/$NAME"
  else
    log INFO "no binary at $BIN_DIR/$NAME"
  fi
  log INFO "review records and settings remain — remove them with: rm -rf ~/.diffle"
  log OK "uninstalled $NAME"
}

# --- download + progress ------------------------------------------------------------------------

download() { curl -fL --silent --show-error "$1" -o "$2" 2>/dev/null; }

hash_asset() {
  case "$HASH_CMD" in
    sha256sum) sha256sum "$1" ;;
    *) shasum -a 256 "$1" ;;
  esac | awk '{print tolower($1); exit}' > "$2"
}

# runs the given command behind a spinner on a tty; prints a single WAIT line when piped
spinner_wait() {
  spin_label="$1"; shift
  if [ "$IS_TTY" != 1 ]; then
    log WAIT "$spin_label"
    "$@"
    return $?
  fi
  "$@" &
  BG_PID=$!
  spin_start="$(date +%s)"
  spin_i=0
  while kill -0 "$BG_PID" 2>/dev/null; do
    spin_i=$((spin_i + 1))
    case $((spin_i % 4)) in
      0) spin_frame='|' ;;
      1) spin_frame='/' ;;
      2) spin_frame='-' ;;
      *) spin_frame='\' ;;
    esac
    printf '\r%s%s%s %s (%ss)' "$C_YELLOW" "$spin_frame" "$C_RESET" "$spin_label" \
      "$(($(date +%s) - spin_start))"
    sleep 0.1 2>/dev/null || sleep 1
  done
  spin_status=0
  wait "$BG_PID" || spin_status=$?
  BG_PID=""
  printf '\r%s\r' "$BLANK"
  return "$spin_status"
}

cleanup() {
  if [ -n "${BG_PID:-}" ]; then kill "$BG_PID" 2>/dev/null || true; fi
  if [ -n "${staged:-}" ]; then rm -f "$staged"; fi
  if [ -n "${tmp:-}" ]; then rm -rf "$tmp"; fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' HUP TERM

if [ "${1:-}" = "--uninstall" ] || [ -n "${DIFFLE_UNINSTALL:-}" ]; then
  uninstall_diffle
  exit 0
fi

# --- detect -------------------------------------------------------------------------------------

section "Detect"
os="$(uname -s)"; arch="$(uname -m)"
case "$os" in Linux) OS=linux ;; Darwin) OS=darwin ;; *) fail "unsupported OS: $os" ;; esac
case "$arch" in x86_64|amd64) ARCH=x64 ;; arm64|aarch64) ARCH=arm64 ;; *) fail "unsupported architecture: $arch" ;; esac
ASSET="$NAME-$OS-$ARCH"
if command -v sha256sum >/dev/null 2>&1; then HASH_CMD=sha256sum
elif command -v shasum >/dev/null 2>&1; then HASH_CMD=shasum
else fail "required checksum command not found: sha256sum or shasum"
fi
log INFO "$os $arch resolves to $OS/$ARCH"
log OK "target asset: $ASSET"

# --- download -----------------------------------------------------------------------------------

section "Download"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/diffle-install.XXXXXX")"
release_json="$tmp/release.json"
spinner_wait "fetching the latest release metadata" download \
  "https://api.github.com/repos/$REPO/releases/latest" "$release_json" \
  || fail "failed to download latest GitHub release metadata"

TAG="$(sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' "$release_json" | head -n1)"
[ -n "$TAG" ] || fail "latest GitHub release has no tag"
case "$TAG" in *[!A-Za-z0-9._-]*) fail "latest GitHub release has an invalid tag" ;; esac

asset_names="$(sed -n 's/^[[:space:]]*"name":[[:space:]]*"\([^"]*\)".*/\1/p' "$release_json")"
printf '%s\n' "$asset_names" | grep -Fqx "$ASSET" || fail "latest release $TAG is missing required asset: $ASSET; no compatible diffle release is available yet"
printf '%s\n' "$asset_names" | grep -Fqx 'checksums.txt' || fail "latest release $TAG is missing required asset: checksums.txt; no compatible diffle release is available yet"
log INFO "latest release is $TAG"

BASE="https://github.com/$REPO/releases/download/$TAG"
spinner_wait "downloading checksums.txt ($TAG)" download "$BASE/checksums.txt" "$tmp/checksums.txt" \
  || fail "failed to download checksums.txt for $TAG"
spinner_wait "downloading $ASSET ($TAG)" download "$BASE/$ASSET" "$tmp/$ASSET" \
  || fail "failed to download $ASSET for $TAG"
log OK "downloaded $ASSET ($TAG)"

# --- verify -------------------------------------------------------------------------------------

section "Verify"
expected="$(awk -v a="$ASSET" 'length($1)==64 && $1 !~ /[^0-9a-fA-F]/ && ($2==a || $2=="*"a) {print tolower($1); exit}' "$tmp/checksums.txt")"
[ -n "$expected" ] || fail "no valid checksum published for $ASSET"
spinner_wait "verifying the sha-256 of $ASSET" hash_asset "$tmp/$ASSET" "$tmp/actual" \
  || fail "failed to compute the sha-256 of $ASSET"
actual="$(cat "$tmp/actual")"
[ "$actual" = "$expected" ] || fail "checksum mismatch for $ASSET"
log OK "sha-256 matches the published checksum"

# --- install ------------------------------------------------------------------------------------

section "Install"
if [ -n "${DIFFLE_DRY_RUN:-}" ]; then
  log WAIT "dry run: would install $NAME $TAG to $BIN_DIR/$NAME"
else
  mkdir -p "$BIN_DIR"
  staged="$BIN_DIR/.$NAME.new-$$"
  install -m 0755 "$tmp/$ASSET" "$staged"
  mv -f "$staged" "$BIN_DIR/$NAME"
  staged=""
  log OK "installed $NAME $TAG to $BIN_DIR/$NAME"
fi

configure_path
