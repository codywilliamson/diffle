#!/bin/sh
# post-deploy check for the docs site. nittle.dev must serve 200s, diffle.dev must 301 to the same
# path and query on nittle.dev. polls until everything passes or SITE_CHECK_TIMEOUT seconds pass,
# which leaves room for the workers builds deploy. usage: sh scripts/check-site.sh
set -u

NEW_HOST="${NEW_HOST:-https://nittle.dev}"
OLD_HOST="${OLD_HOST:-https://diffle.dev}"
TIMEOUT="${SITE_CHECK_TIMEOUT:-600}"
INTERVAL="${SITE_CHECK_INTERVAL:-20}"

SERVED_PATHS="/ /install /install.ps1"
REDIRECT_PATHS="/ /install /install.ps1 /getting-started/installation/?x=1"

failures=""

fail() {
  failures="${failures}  $1
"
}

# prints the status and the Location header (empty when absent), no redirect following
probe() {
  curl -s -o /dev/null --max-time 15 -w '%{http_code} %{redirect_url}' "$1"
}

check_once() {
  failures=""
  for path in $SERVED_PATHS; do
    out=$(probe "${NEW_HOST}${path}")
    code=${out%% *}
    [ "$code" = "200" ] || fail "${NEW_HOST}${path}: expected 200, got ${code:-none}"
  done
  for path in $REDIRECT_PATHS; do
    out=$(probe "${OLD_HOST}${path}")
    code=${out%% *}
    location=${out#* }
    want="${NEW_HOST}${path}"
    if [ "$code" != "301" ]; then
      fail "${OLD_HOST}${path}: expected 301, got ${code:-none}"
    elif [ "$location" != "$want" ]; then
      fail "${OLD_HOST}${path}: expected Location ${want}, got ${location:-none}"
    fi
  done
  [ -z "$failures" ]
}

deadline=$(( $(date +%s) + TIMEOUT ))
while :; do
  if check_once; then
    echo "site check passed: ${NEW_HOST} serves, ${OLD_HOST} redirects"
    exit 0
  fi
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "site check failed after ${TIMEOUT}s:" >&2
    printf '%s' "$failures" >&2
    exit 1
  fi
  echo "not ready yet, retrying in ${INTERVAL}s" >&2
  sleep "$INTERVAL"
done
