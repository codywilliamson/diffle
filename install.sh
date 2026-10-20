#!/bin/sh
# nittle installer — downloads the matching release binary, verifies its sha-256, installs it to
# ~/.nittle/bin, and persists that directory on PATH via a marker block in your shell rc.
# An existing diffle install is migrated: after installing, `nittle --version` runs once and the
# binary's own startup migration moves data and plugins and removes every diffle leftover.
# Usage: curl -fsSL https://<host>/install | sh   (uninstall: sh install.sh --uninstall)
# Env: NITTLE_INSTALL_DIR, NITTLE_NO_MODIFY_PATH, NITTLE_NO_SETUP, NITTLE_NO_COMPLETIONS, NITTLE_DRY_RUN,
#      NITTLE_UNINSTALL, NO_COLOR,
#      GITHUB_TOKEN (optional; authenticates the release lookup)
#      each NITTLE_* falls back to its deprecated DIFFLE_* twin
set -eu

REPO="codywilliamson/diffle" # the github repo keeps its old slug until it is renamed
NAME="nittle"
LEGACY_NAME="diffle"

# NITTLE_<name>, else the deprecated DIFFLE_<name>
opt() { eval "printf '%s' \"\${NITTLE_$1:-\${DIFFLE_$1:-}}\""; }
INSTALL_DIR_OVERRIDE="$(opt INSTALL_DIR)"
NO_MODIFY_PATH="$(opt NO_MODIFY_PATH)"
NO_SETUP="$(opt NO_SETUP)"
DRY_RUN="$(opt DRY_RUN)"
UNINSTALL="$(opt UNINSTALL)"

BIN_DIR="${INSTALL_DIR_OVERRIDE:-$HOME/.nittle/bin}"
LEGACY_BIN_DIR="${DIFFLE_INSTALL_DIR:-$HOME/.diffle/bin}"
MARKER_START="# >>> nittle >>>"
MARKER_END="# <<< nittle <<<"
LEGACY_MARKER_START="# >>> diffle >>>"
LEGACY_MARKER_END="# <<< diffle <<<"
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

fail() { printf '%snittle install: %s%s\n' "$C_RED" "$*" "$C_RESET" >&2; exit 1; }

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
    append_backup="$append_rc.nittle.bak-$(date +%Y%m%d-%H%M%S)"
    cp "$append_rc" "$append_backup"
    log INFO "backed up $append_rc to $append_backup"
  fi
  {
    printf '\n%s\n' "$MARKER_START"
    printf '%s\n' "$append_body"
    printf '%s\n' "$MARKER_END"
  } >> "$append_rc"
}

# awk over a file with each \r swapped for \001, so crlf survives awk builds that read text mode
# (git bash on windows). usage: awk_keep_cr <in> <out> <awk args...>; returns awk's status
awk_keep_cr() {
  akc_in="$1"; akc_out="$2"; shift 2
  tr '\r' '\001' < "$akc_in" > "$akc_out.a"
  akc_status=0
  awk "$@" "$akc_out.a" > "$akc_out.b" || akc_status=$?
  tr '\001' '\r' < "$akc_out.b" > "$akc_out"
  rm -f "$akc_out.a" "$akc_out.b"
  return "$akc_status"
}

# drops the marker block plus the single blank line we inserted above it, so the rest of the file
# stays byte-identical to what it was before the install
strip_block() {
  strip_rc="$1"; strip_start="$2"; strip_end="$3"
  [ -f "$strip_rc" ] || return 0
  tr -d '\r' < "$strip_rc" | grep -qxF "$strip_start" || return 0
  strip_tmp="$strip_rc.nittle.tmp.$$"
  # markers match with an optional trailing \r, so crlf files work; kept lines are printed untouched
  awk_keep_cr "$strip_rc" "$strip_tmp" -v s="$strip_start" -v e="$strip_end" '
    function flush_blanks(  i) { for (i = 0; i < held; i++) print blank; held = 0 }
    BEGIN { held = 0; skip = 0; blank = "" }
    { line = $0; sub(/\001$/, "", line) }
    skip { if (line == e) skip = 0; next }
    line == s { if (held > 0) held--; flush_blanks(); skip = 1; next }
    line == "" { blank = $0; held++; next }
    { flush_blanks(); print }
    END { flush_blanks() }
  '
  cat "$strip_tmp" > "$strip_rc"; rm -f "$strip_tmp" # in place: keeps mode, owner and symlinks
  log OK "removed the PATH block ($strip_start) from $strip_rc"
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
  if [ -n "$DRY_RUN" ]; then
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
  if [ -n "$NO_MODIFY_PATH" ]; then
    log INFO "NITTLE_NO_MODIFY_PATH is set; leaving $RC_FILE untouched"
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
  if [ -n "$DRY_RUN" ]; then
    log WAIT "dry run: would append the nittle PATH block to $RC_FILE"
    log INFO "  $path_body"
    ensure_bash_profile
    return 0
  fi
  append_block "$RC_FILE" "$path_body"
  log OK "added $BIN_DIR to PATH in $RC_FILE"
  ensure_bash_profile
  activation_hint
}

# both ends must be a terminal: a readable /dev/tty with redirected output would prompt invisibly
has_terminal() {
  [ -t 1 ] && [ -r /dev/tty ] && ( : </dev/tty ) 2>/dev/null
}

FISH_MARKER="# installed by nittle"
# only a file carrying our first-line marker is ours to overwrite or remove
fish_file_is_ours() { [ "$(head -n 1 "$1" | tr -d '\r')" = "$FISH_MARKER" ]; }
fish_completions_file() { printf '%s' "${XDG_CONFIG_HOME:-$HOME/.config}/fish/completions/$NAME.fish"; }

# agent configs point at the binary, so unregister them while it still exists. releases before
# `setup` existed would treat it as a git ref, so check the help text first
offer_agent_teardown() {
  [ -z "$NO_SETUP" ] || return 0
  [ -x "$BIN_DIR/$NAME" ] && "$BIN_DIR/$NAME" --help 2>/dev/null | grep -q " setup" || return 0
  if has_terminal; then
    # a cancelled or failed teardown keeps the binary so `setup --remove` can still be rerun
    "$BIN_DIR/$NAME" setup --remove </dev/tty \
      || fail "agent teardown did not finish, so $NAME is still installed; rerun, or set NITTLE_NO_SETUP=1 to skip it"
  else
    log INFO "no terminal: if you ran '$NAME setup', run '$NAME setup --remove' before uninstalling"
  fi
}

# every file this installer (or the diffle one) may have written a PATH block into
RC_CANDIDATES_CMD='"${ZDOTDIR:-$HOME}/.zshrc" "$HOME/.bashrc" "$HOME/.bash_profile" "$HOME/.profile" "${XDG_CONFIG_HOME:-$HOME/.config}/fish/config.fish"'

# an existing diffle install: its binary, its PATH entry, or its marker block
legacy_install_present() {
  [ -e "$LEGACY_BIN_DIR/$LEGACY_NAME" ] && return 0
  case ":$PATH:" in *":$LEGACY_BIN_DIR:"*) return 0 ;; esac
  eval "set -- $RC_CANDIDATES_CMD"
  for rc_candidate in "$@"; do
    if [ -f "$rc_candidate" ] && grep -qxF "$LEGACY_MARKER_START" "$rc_candidate"; then return 0; fi
  done
  return 1
}

# a 0.28.x install made once with a custom DIFFLE_INSTALL_DIR leaves no variable behind; its dir is
# still recorded in the old installer's marker block and on PATH. the dir is only trusted when it
# really holds a diffle binary, and system package dirs are never considered
legacy_dir_from_rc() {
  eval "set -- $RC_CANDIDATES_CMD"
  for rc_candidate in "$@"; do
    [ -f "$rc_candidate" ] || continue
    block_dir="$(awk -v s="$LEGACY_MARKER_START" -v e="$LEGACY_MARKER_END" '
      $0 == s { inside = 1; next }
      $0 == e { inside = 0; next }
      inside { print }' "$rc_candidate" | sed -n -e 's/^export PATH="\(.*\):\$PATH"$/\1/p' -e 's/^fish_add_path "\(.*\)"$/\1/p' | head -n1)"
    if [ -n "$block_dir" ] && [ -f "$block_dir/$LEGACY_NAME" ]; then printf '%s' "$block_dir"; return 0; fi
  done
  return 1
}

legacy_dir_from_path() {
  path_rest="$PATH:"
  while [ -n "$path_rest" ]; do
    path_entry="${path_rest%%:*}"; path_rest="${path_rest#*:}"
    case "$path_entry" in ""|/usr/*|/bin|/sbin|/opt/homebrew/*|/nix/*|*/Cellar/*) continue ;; esac
    if [ -f "$path_entry/$LEGACY_NAME" ]; then printf '%s' "$path_entry"; return 0; fi
  done
  return 1
}

discover_legacy_dir() {
  [ -z "${DIFFLE_INSTALL_DIR:-}" ] || return 0
  [ ! -f "$LEGACY_BIN_DIR/$LEGACY_NAME" ] || return 0
  found_dir="$(legacy_dir_from_rc || legacy_dir_from_path || true)"
  if [ -n "$found_dir" ]; then LEGACY_BIN_DIR="$found_dir"; fi
}

remove_file() {
  if [ -f "$1" ]; then
    rm -f "$1"
    log OK "removed $1"
  fi
}

# removes only a dir that is already empty
remove_empty_dir() {
  rmdir "$1" 2>/dev/null && log OK "removed empty $1" || true
}

uninstall_nittle() {
  section "Uninstall"
  resolve_rc
  if [ -n "$DRY_RUN" ]; then
    log WAIT "dry run: would remove the PATH blocks, $BIN_DIR/$NAME and any $LEGACY_NAME leftovers"
    return 0
  fi
  offer_agent_teardown
  eval "set -- $RC_CANDIDATES_CMD"
  for rc_candidate in "$@"; do
    strip_block "$rc_candidate" "$MARKER_START" "$MARKER_END"
    strip_block "$rc_candidate" "$LEGACY_MARKER_START" "$LEGACY_MARKER_END"
  done
  remove_file "$BIN_DIR/$NAME"
  if [ -f "$(fish_completions_file)" ]; then
    if fish_file_is_ours "$(fish_completions_file)"; then remove_file "$(fish_completions_file)"
    else log INFO "$(fish_completions_file) was not written by this installer; leaving it"; fi
  fi
  remove_file "$LEGACY_BIN_DIR/$LEGACY_NAME"
  rm -f "$BIN_DIR"/."$NAME".new-* "$LEGACY_BIN_DIR"/."$LEGACY_NAME".new-* 2>/dev/null || true
  remove_empty_dir "$BIN_DIR"
  remove_empty_dir "$LEGACY_BIN_DIR"
  remove_empty_dir "$HOME/.nittle"
  remove_empty_dir "$HOME/.diffle"
  if [ -d "$HOME/.nittle" ]; then
    log INFO "review records and settings remain — remove them with: rm -rf ~/.nittle"
  fi
  log OK "uninstalled $NAME"
}

# --- download + progress ------------------------------------------------------------------------

# curl's own error is kept so a failed download can say why (http status, dns, tls)
download() {
  dl_url="$1"; dl_out="$2"; shift 2
  curl -fL --silent --show-error "$@" "$dl_url" -o "$dl_out" 2>"$tmp/curl.err"
}

# the api call authenticates when GITHUB_TOKEN is set (ci), dodging the anonymous rate limit
# that shared runner ips hit; asset downloads stay anonymous
fetch_release_json() {
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    download "$1" "$2" -H "Authorization: Bearer $GITHUB_TOKEN"
  else
    download "$1" "$2"
  fi
}

download_failed() {
  dl_reason="$(sed -n '$p' "$tmp/curl.err" 2>/dev/null)"
  fail "$1${dl_reason:+ ($dl_reason)}"
}

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

# one line per deprecated DIFFLE_* variable that is standing in for an unset NITTLE_* one
LEGACY_OPTIONS="INSTALL_DIR NO_MODIFY_PATH NO_SETUP DRY_RUN UNINSTALL"
notice_legacy_options() {
  for legacy_option in $LEGACY_OPTIONS; do
    if [ -n "$(eval "printf '%s' \"\${NITTLE_$legacy_option:-}\"")" ]; then continue; fi
    if [ -n "$(eval "printf '%s' \"\${DIFFLE_$legacy_option:-}\"")" ]; then
      log INFO "DIFFLE_$legacy_option is deprecated; used as a fallback. set NITTLE_$legacy_option instead"
    fi
  done
}
notice_legacy_options

discover_legacy_dir

if [ "${1:-}" = "--uninstall" ] || [ -n "$UNINSTALL" ]; then
  uninstall_nittle
  exit 0
fi

# --- detect -------------------------------------------------------------------------------------

section "Detect"
LEGACY_FOUND=0
if legacy_install_present; then LEGACY_FOUND=1; log INFO "found an existing $LEGACY_NAME install"; fi
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
tmp="$(mktemp -d "${TMPDIR:-/tmp}/nittle-install.XXXXXX")"
release_json="$tmp/release.json"
spinner_wait "fetching the latest release metadata" fetch_release_json \
  "https://api.github.com/repos/$REPO/releases/latest" "$release_json" \
  || download_failed "failed to download latest GitHub release metadata"

TAG="$(sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' "$release_json" | head -n1)"
[ -n "$TAG" ] || fail "latest GitHub release has no tag"
case "$TAG" in *[!A-Za-z0-9._-]*) fail "latest GitHub release has an invalid tag" ;; esac

asset_names="$(sed -n 's/^[[:space:]]*"name":[[:space:]]*"\([^"]*\)".*/\1/p' "$release_json")"
printf '%s\n' "$asset_names" | grep -Fqx "$ASSET" || fail "latest release $TAG is missing required asset: $ASSET; no compatible nittle release is available yet"
printf '%s\n' "$asset_names" | grep -Fqx 'checksums.txt' || fail "latest release $TAG is missing required asset: checksums.txt; no compatible nittle release is available yet"
log INFO "latest release is $TAG"

BASE="https://github.com/$REPO/releases/download/$TAG"
spinner_wait "downloading checksums.txt ($TAG)" download "$BASE/checksums.txt" "$tmp/checksums.txt" \
  || download_failed "failed to download checksums.txt for $TAG"
spinner_wait "downloading $ASSET ($TAG)" download "$BASE/$ASSET" "$tmp/$ASSET" \
  || download_failed "failed to download $ASSET for $TAG"
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
if [ -n "$DRY_RUN" ]; then
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

# --- migrate diffle -----------------------------------------------------------------------------

# the installed binary migrates data, plugins, PATH and the diffle binary on its first run; the
# installer only triggers that run, it carries none of the logic
migrate_legacy_install() {
  [ "$LEGACY_FOUND" = 1 ] || return 0
  section "Migrate $LEGACY_NAME"
  if [ -n "$DRY_RUN" ]; then
    log WAIT "dry run: would run '$NAME --version' so the existing $LEGACY_NAME install migrates"
    return 0
  fi
  # NITTLE_LEGACY_INSTALL_DIR tells the binary where the diffle install is, wherever it was put
  if NITTLE_LEGACY_INSTALL_DIR="$LEGACY_BIN_DIR" "$BIN_DIR/$NAME" --version; then
    log OK "$LEGACY_NAME install migrated"
  else
    log WARN "'$NAME --version' failed; the $LEGACY_NAME leftovers go on the next successful $NAME run"
  fi
}

migrate_legacy_install

# --- shell completions --------------------------------------------------------------------------

# the line lives inside the installer's own PATH marker block; the rc is never edited anywhere else
completion_line() {
  case "$SHELL_NAME" in
    zsh) printf 'command -v %s >/dev/null 2>&1 && source <(%s completion --shell zsh)' "$NAME" "$NAME" ;;
    bash) printf 'command -v %s >/dev/null 2>&1 && eval "$(%s completion --shell bash)"' "$NAME" "$NAME" ;;
    *) return 1 ;;
  esac
}

PROBE_TIMEOUT_SECONDS=5

# test seams, honoured only when NITTLE_INSTALLER_TEST=1 so an inherited variable can't change a
# real install: NITTLE_TEST_TTY (a file holding the answer, standing in for /dev/tty) and
# NITTLE_TEST_PROBE_TIMEOUT
test_seam() {
  [ "${NITTLE_INSTALLER_TEST:-}" = 1 ] || return 0
  eval "printf '%s' \"\${NITTLE_TEST_$1:-}\""
}
TEST_TTY="$(test_seam TTY)"
if [ -n "$(test_seam PROBE_TIMEOUT)" ]; then PROBE_TIMEOUT_SECONDS="$(test_seam PROBE_TIMEOUT)"; fi

# does the installed binary know `completion`? bounded, so a hung binary can't stall the installer.
# background + kill because `timeout` is not on macOS by default
probe_completions() {
  "$BIN_DIR/$NAME" completion --shell "$SHELL_NAME" >/dev/null 2>&1 </dev/null &
  probe_pid=$!
  ( sleep "$PROBE_TIMEOUT_SECONDS"; kill "$probe_pid" 2>/dev/null ) >/dev/null 2>&1 &
  probe_killer=$!
  probe_status=0
  wait "$probe_pid" || probe_status=$?
  kill "$probe_killer" 2>/dev/null || true
  wait "$probe_killer" 2>/dev/null || true
  if [ "$probe_status" -ge 128 ]; then log INFO "'$NAME completion' did not answer; skipping completions"; fi
  [ "$probe_status" -eq 0 ]
}

read_completion_answer() {
  if [ -n "$TEST_TTY" ]; then
    printf 'Install %s shell completions for %s? [y/N] ' "$NAME" "$SHELL_NAME"
    read -r completion_answer <"$TEST_TTY" || completion_answer=n
    return 0
  fi
  printf 'Install %s shell completions for %s? [y/N] ' "$NAME" "$SHELL_NAME" >/dev/tty
  read -r completion_answer </dev/tty || completion_answer=n
}

wire_fish_completions() {
  fish_file="$(fish_completions_file)"
  mkdir -p "${fish_file%/*}"
  if [ -e "$fish_file" ] && ! fish_file_is_ours "$fish_file"; then
    log WARN "$fish_file exists and was not written by this installer; leaving it alone"
    return 0
  fi
  if { printf '%s\n' "$FISH_MARKER"; "$BIN_DIR/$NAME" completion --shell fish; } > "$fish_file.tmp.$$"; then
    mv -f "$fish_file.tmp.$$" "$fish_file"
    log OK "fish completions written to $fish_file"
  else
    rm -f "$fish_file.tmp.$$"
    log WARN "could not generate fish completions; run '$NAME completion --shell fish' yourself"
  fi
}

wire_rc_completions() {
  completion_rc_line="$(completion_line)"
  completion_status=2
  if [ -f "$RC_FILE" ]; then
    completion_tmp="$RC_FILE.nittle.tmp.$$"
    # insert only between a whole-line opening marker and the next whole-line closing one; the
    # inserted line takes the closing marker's line ending. exit 2 = no block, 3 = already there
    awk_keep_cr "$RC_FILE" "$completion_tmp" -v s="$MARKER_START" -v e="$MARKER_END" -v add="$completion_rc_line" -v sh="completion --shell $SHELL_NAME" '
      { line = $0; sub(/\001$/, "", line) }
      state == 0 && line == s { state = 1; print; next }
      state == 1 && index(line, sh) && line !~ /^[ \t]*#/ { dup = 1 }
      state == 1 && line == e { cr = ($0 ~ /\001$/) ? "\001" : ""; if (!dup) print add cr; state = 2 }
      { print }
      END { exit (state < 2) ? 2 : (dup ? 3 : 0) }
    ' && completion_status=0 || completion_status=$?
    if [ "$completion_status" -eq 0 ]; then
      # awk ends every line with a newline; an rc that had none on its last line keeps it that way
      if [ -n "$(tail -c 1 "$RC_FILE")" ]; then
        head -c "$(($(wc -c < "$completion_tmp") - 1))" "$completion_tmp" > "$completion_tmp.trim"
        mv -f "$completion_tmp.trim" "$completion_tmp"
      fi
      cat "$completion_tmp" > "$RC_FILE"
    fi
    rm -f "$completion_tmp"
  fi
  if [ "$completion_status" -eq 0 ]; then
    log OK "completions added to the $NAME block in $RC_FILE (open a new shell)"
  elif [ "$completion_status" -eq 3 ]; then
    log INFO "completions already wired in $RC_FILE; no change"
  else
    # no PATH block of ours to put it in, and the rc is never edited outside that block
    log INFO "to enable completions add this line to $RC_FILE:"
    printf '  %s\n' "$completion_rc_line"
  fi
}

# asks once, defaults to no. skipped silently on dry runs, NITTLE_NO_COMPLETIONS, no terminal, an
# unsupported shell, or a release too old to have `completion`
offer_completions() {
  if [ -n "$DRY_RUN" ] || [ -n "${NITTLE_NO_COMPLETIONS:-}" ]; then return 0; fi
  resolve_rc
  case "$SHELL_NAME" in zsh|bash|fish) ;; *) return 0 ;; esac
  if [ -z "$TEST_TTY" ]; then has_terminal || return 0; fi
  probe_completions || return 0
  section "Completions"
  completion_answer=n
  read_completion_answer
  case "$completion_answer" in
    y|Y|yes|Yes|YES) ;;
    *) log INFO "skipped; run '$NAME completion --shell $SHELL_NAME' any time to print the script"; return 0 ;;
  esac
  if [ "$SHELL_NAME" = fish ]; then wire_fish_completions; else wire_rc_completions; fi
}

offer_completions

# --- agent setup --------------------------------------------------------------------------------

# stdin is the curl pipe, so the prompt and the setup command both talk to /dev/tty; skipped when
# there is no usable terminal, on dry runs, or when NITTLE_NO_SETUP is set. a failed setup never
# fails the install
offer_agent_setup() {
  if [ -n "$DRY_RUN" ] || [ -n "$NO_SETUP" ]; then return 0; fi
  has_terminal || return 0
  section "Agent setup"
  printf 'Set up %s for your coding agents? [Y/n] ' "$NAME"
  setup_answer=""
  read -r setup_answer </dev/tty || setup_answer=n
  case "$setup_answer" in
    n|N|no|No|NO) log INFO "skipped; run '$NAME setup' any time to wire up your coding agents"; return 0 ;;
  esac
  if "$BIN_DIR/$NAME" setup </dev/tty; then
    log OK "agent setup complete"
  else
    log WARN "agent setup did not finish; run '$NAME setup' to retry"
  fi
}

offer_agent_setup
