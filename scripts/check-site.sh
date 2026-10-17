#!/bin/sh
# post-deploy check for the docs site. nittle.dev must serve 200s, diffle.dev must 301 to the same
# path and query on nittle.dev. polls until everything passes or SITE_CHECK_TIMEOUT seconds pass,
# which leaves room for the workers builds deploy. never runs past the timeout.
# usage: sh scripts/check-site.sh
set -u

NEW_HOST="${NEW_HOST:-https://nittle.dev}"
OLD_HOST="${OLD_HOST:-https://diffle.dev}"
TIMEOUT="${SITE_CHECK_TIMEOUT:-600}"
INTERVAL="${SITE_CHECK_INTERVAL:-20}"
REQUEST_MAX_TIME=15
CURL="${CURL:-curl}"

SERVED_PATHS="/ /install /install.ps1"
REDIRECT_PATHS="/ /install /install.ps1 /getting-started/installation/?x=1"

failures=""
deadline=$(( $(date +%s) + TIMEOUT ))

fail() {
  failures="${failures}  $1
"
}

remaining() {
  echo $(( deadline - $(date +%s) ))
}

# sets probe_rc (curl exit code), probe_code and probe_location. no redirect following.
# the per-request time limit never exceeds the time left before the deadline.
probe() {
  left=$(remaining)
  if [ "$left" -le 0 ]; then
    probe_rc=28
    probe_code=""
    probe_location=""
    return
  fi
  max=$REQUEST_MAX_TIME
  [ "$left" -lt "$max" ] && max=$left
  out=$($CURL -s -o /dev/null --max-time "$max" -w '%{http_code} %{redirect_url}' "$1")
  probe_rc=$?
  probe_code=${out%% *}
  probe_location=${out#* }
  [ "$probe_location" = "$out" ] && probe_location=""
}

check_once() {
  failures=""
  for path in $SERVED_PATHS; do
    probe "${NEW_HOST}${path}"
    if [ "$probe_rc" -ne 0 ]; then
      fail "${NEW_HOST}${path}: curl failed with exit code ${probe_rc}"
    elif [ "$probe_code" != "200" ]; then
      fail "${NEW_HOST}${path}: expected 200, got ${probe_code:-none}"
    fi
  done
  for path in $REDIRECT_PATHS; do
    probe "${OLD_HOST}${path}"
    want="${NEW_HOST}${path}"
    if [ "$probe_rc" -ne 0 ]; then
      fail "${OLD_HOST}${path}: curl failed with exit code ${probe_rc}"
    elif [ "$probe_code" != "301" ]; then
      fail "${OLD_HOST}${path}: expected 301, got ${probe_code:-none}"
    elif [ "$probe_location" != "$want" ]; then
      fail "${OLD_HOST}${path}: expected Location ${want}, got ${probe_location:-none}"
    fi
  done
  [ -z "$failures" ]
}

while :; do
  check_once
  passed=$?
  left=$(remaining)
  # a batch that finishes after the deadline fails even if every probe passed
  if [ "$passed" -eq 0 ] && [ "$left" -ge 0 ]; then
    echo "site check passed: ${NEW_HOST} serves, ${OLD_HOST} redirects"
    exit 0
  fi
  if [ "$left" -le 0 ]; then
    [ -z "$failures" ] && fail "finished after the ${TIMEOUT}s deadline"
    echo "site check failed after ${TIMEOUT}s:" >&2
    printf '%s' "$failures" >&2
    exit 1
  fi
  wait_for=$INTERVAL
  [ "$left" -lt "$wait_for" ] && wait_for=$left
  echo "not ready yet, retrying in ${wait_for}s" >&2
  sleep "$wait_for"
done
