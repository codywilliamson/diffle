---
title: Configuration
description: Environment variables, the data directory, and update behavior for nittle.
sidebar:
  order: 2
---

## Environment variables

Use the `NITTLE_*` form. The old `DIFFLE_*` names are deprecated: they are still read as a fallback (`NITTLE_*` wins when both are set), and the first launch that sees one prints a one-time notice on stderr naming each var to rename, for example `DIFFLE_DATA_DIR -> NITTLE_DATA_DIR`. nittle never edits your shell profile. `LOUPE_*` is no longer read.

| variable | effect |
| --- | --- |
| `NITTLE_DATA_DIR` | override the data directory that holds Review Records + session state |
| `NITTLE_INSTALL_DIR` | installer only — where the binary is placed (default `~/.nittle/bin`) |
| `NITTLE_ROOT` | MCP: the approved root the server may review under |
| `NITTLE_SESSION_HOST` | internal: which integration launched a session (`cli` / `hook`) |
| `NITTLE_NO_OPEN` | set to `1` to suppress auto-opening the browser |
| `NITTLE_HOOK_NO_SPAWN` | set to `1` so the completion hook doesn't spawn a review |
| `NITTLE_NO_UPDATE_CHECK` | set to `1` to silence the new-release notice at launch (and doctor's release check) |

## Data directory

nittle keeps its data in `~/.nittle`. On first run it moves an existing `~/.diffle` (and, for installs that never left it, `~/.loupe`) there: a single rename when `~/.nittle` does not exist yet, otherwise a merge that copies review records by ID without overwriting (a record already in `~/.nittle` wins and the other copy is left in place with a printed note), carries over sessions and user state that are missing, checks every file at its new location, and only then removes the old directory. If anything fails, both directories are kept, the leftover paths are printed, and the next run retries. See [Migrating from diffle](/guides/migrating-from-diffle/).

With `NITTLE_DATA_DIR` (or the deprecated `DIFFLE_DATA_DIR`) pointing somewhere other than `~/.nittle`, the home directories are left alone.

Review Records live at `<data dir>/reviews/<review-id>/review.json` and keep the git comparison, comments, replies, addressed/resolved state, summary, and outcome. Approved and cancelled reviews stay local until deleted.

User-level state — such as the dismissed What's-New version — lives in `<data dir>/state.json`.

Legacy `.review` files in a repo are treated as legacy data: nittle leaves them untouched and offers to import, remove (with confirmation), or ignore.

## Language servers

`nittle lsp` prints one line per language: the server that would run, or `not on PATH (tried X, Y)` followed by an install hint. Stored overrides are listed after the table.

```sh
nittle lsp
```

Override a server for good with `lsp set`. Quote the command when it has arguments, and use an empty string to disable a language. `lsp unset` drops the override.

```sh
nittle lsp set python "basedpyright-langserver --stdio"
nittle lsp set rust ""
nittle lsp unset python
```

Overrides live in `<data dir>/state.json` under `lspOverrides`. For one run only, pass `--lsp <lang>=<command>` (repeatable) to `nittle` or `nittle show`; it wins over a stored override, and `--lsp rust=` disables rust for that run.

```sh
nittle --lsp rust=rust-analyzer --lsp go=
```

The languages are `typescript`, `csharp`, `python`, `go`, `rust`, `vue` and `svelte`. A command is split into arguments and run directly, with no shell, so pipes and `&&` are passed to the server as plain arguments. Like any server, it is refused if it resolves inside the repository under review.

Python looks in an active virtualenv first: when `VIRTUAL_ENV` is set, its `bin` (`Scripts` on Windows) directory is searched before `PATH`, and the server is started with that environment so it resolves the venv's site-packages.

## Update behavior

`nittle update` checks the GitHub Releases channel against the installed version, downloads the matching asset, verifies its SHA-256 against the published `checksums.txt`, and swaps the binary. On Windows the running exe is renamed aside (`.nittle.exe.old`, removed by the next update) so the swap works even while MCP servers are running. Afterwards it stops MCP servers still on the old binary, unless a review session is live; agents relaunch them on reconnect.

It refuses to self-update when a package manager owns the install, and prints that manager's command instead.

Update checks are best-effort and fail quietly offline.
