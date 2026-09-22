---
title: Configuration
description: Environment variables, the data directory, and update behavior for diffle.
sidebar:
  order: 2
---

## Environment variables

Prefer the `DIFFLE_*` form. The legacy `LOUPE_*` form is honored during the compatibility window.

| variable | effect |
| --- | --- |
| `DIFFLE_DATA_DIR` | override the data directory that holds Review Records + session state |
| `DIFFLE_INSTALL_DIR` | installer only — where the binary is placed (default `~/.diffle/bin`) |
| `DIFFLE_ROOT` | MCP: the approved root the server may review under |
| `DIFFLE_SESSION_HOST` | internal: which integration launched a session (`cli` / `hook`) |
| `DIFFLE_NO_OPEN` | set to `1` to suppress auto-opening the browser |
| `DIFFLE_HOOK_NO_SPAWN` | set to `1` so the completion hook doesn't spawn a review |
| `DIFFLE_NO_UPDATE_CHECK` | set to `1` to silence the new-release notice at launch (and doctor's release check) |

## Data directory

New installs use `~/.diffle`. If `~/.loupe` exists and `~/.diffle` does not, diffle keeps using `~/.loupe` — nothing is copied or deleted.

Review Records live at `<data dir>/reviews/<review-id>/review.json` and keep the git comparison, comments, replies, addressed/resolved state, summary, and outcome. Approved and cancelled reviews stay local until deleted.

User-level state — such as the dismissed What's-New version — lives in `<data dir>/state.json`.

Legacy `.review` files in a repo are treated as legacy data: diffle leaves them untouched and offers to import, remove (with confirmation), or ignore.

## Update behavior

`diffle update` checks the GitHub Releases channel against the installed version, downloads the matching asset, verifies its SHA-256 against the published `checksums.txt`, and swaps the binary. On Windows the running exe is renamed aside (`.diffle.exe.old`, removed by the next update) so the swap works even while MCP servers are running. Afterwards it stops MCP servers still on the old binary, unless a review session is live; agents relaunch them on reconnect.

It refuses to self-update when a package manager owns the install, and prints that manager's command instead.

Update checks are best-effort and fail quietly offline.
