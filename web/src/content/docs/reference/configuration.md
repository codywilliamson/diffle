---
title: Configuration
description: nittle's environment variables, data directory layout, language server overrides, browser prefs and update behavior.
sidebar:
  order: 3
---

nittle has no config file. You configure it with environment variables, `nittle lsp set`, and CLI flags.

## Environment variables

Boolean variables marked `1` must be exactly `1`. Variables marked "any value" are on when set to anything non-empty.

### Read by the nittle binary

| variable | default | read by | effect |
| --- | --- | --- | --- |
| `NITTLE_DATA_DIR` | `~/.nittle` | review records, session registry | moves `reviews/` and `sessions/`. `state.json`, `drafts/` and `migration-conflicts/` stay in `~/.nittle` |
| `NITTLE_ROOT` | the directory `nittle mcp serve` started in | MCP server | the one approved root; `start_review` rejects a `cwd` outside it with `cwd must be inside an approved MCP root` |
| `NITTLE_NO_OPEN` | unset | MCP `start_review`, `nittle hook stop` | `1` = don't open a browser. Plain `nittle` ignores it; use `--no-open` |
| `NITTLE_HOOK_NO_SPAWN` | unset | `nittle hook stop` | `1` = create the Review Record but spawn no review process |
| `NITTLE_NO_UPDATE_CHECK` | unset | launch notice, update badge, `nittle doctor` | any value = no new-release line at launch, no update badge in the tab, and no release check in doctor. nittle makes no release calls at all. The launch notice is also off when `CI` is set or when running from source |
| `NITTLE_INSTALL_DIR` | `~/.nittle/bin` | installers and the binary | where the binary lives. The binary reads it to resolve the command it writes into agent MCP configs, and where the migration copies itself |
| `NITTLE_SESSION_HOST` | unset | review launch | internal: `hook` marks a session as hook-hosted, otherwise it is `cli`. The stop hook sets it on the process it spawns |
| `VIRTUAL_ENV` | unset | Python language server lookup | its `bin` (`Scripts` on Windows) is searched before `PATH`, and the server starts with that environment |
| `CLAUDE_CONFIG_DIR` | `~/.claude` | `nittle setup`, `nittle doctor` | where to look for Claude Code |
| `CI` | unset | launch notice | any value = no new-release line at launch |

### Read by `install.sh` and `install.ps1`

| variable | default | effect |
| --- | --- | --- |
| `NITTLE_INSTALL_DIR` | `~/.nittle/bin` | where the binary is placed |
| `NITTLE_NO_MODIFY_PATH` | unset | any value = don't edit the shell rc file (`install.sh`) or the user `PATH` (`install.ps1`) |
| `NITTLE_NO_SETUP` | unset | any value = skip the `nittle setup` offer, and the agent teardown on uninstall |
| `NITTLE_NO_COMPLETIONS` | unset | any value = skip the shell completion offer |
| `NITTLE_DRY_RUN` | unset | any value = print the plan and write nothing |
| `NITTLE_UNINSTALL` | unset | any value = uninstall instead of install |
| `GITHUB_TOKEN` | unset | authenticates the release lookup, which avoids the anonymous rate limit |
| `NO_COLOR` | unset | `install.sh` prints without color |

### PATH changes made by the installers

On macOS and Linux, `install.sh` appends a marked block to your login shell's rc file: `.zshrc` for zsh (under `ZDOTDIR` if set), `.bashrc` for bash (plus a `.bash_profile` that sources it on macOS), `config.fish` for fish, `.profile` for anything else.

```sh
# >>> nittle >>>
export PATH="$HOME/.nittle/bin:$PATH"
# <<< nittle <<<
```

Nothing else in the file is reordered or rewritten. Each edit first copies the file to `<rc>.nittle.bak-<timestamp>`, so one install can leave more than one backup. Running the installer again changes nothing. A child process can't change the shell that launched it, so run `exec $SHELL -l` (fish: `source <rc>`) to use `nittle` right away.

On Windows, `install.ps1` edits only your user `PATH`, never the machine scope and never the merged process value. It backs the old value up to a timestamped file in your temp directory first, keeps every existing entry (`%VAR%` tokens included), and does nothing if `~\.nittle\bin` is already there.

`NITTLE_NO_MODIFY_PATH` skips the edit on both (`install.sh` prints the `export` line instead), and `NITTLE_DRY_RUN` logs every intended change without writing anything.

Every `NITTLE_*` variable falls back to its deprecated `DIFFLE_*` twin (`NITTLE_*` wins when both are set), and the first launch that uses one prints a one-time rename notice such as `DIFFLE_DATA_DIR -> NITTLE_DATA_DIR`. `LOUPE_*` is not read.

## Data directory

| path | holds | moved by `NITTLE_DATA_DIR` |
| --- | --- | --- |
| `~/.nittle/reviews/<review-id>/review.json` | Review Records: comparison, comments, replies, comment status, summary, outcome, activity, last round | yes |
| `~/.nittle/sessions/<session-id>.json` | the session registry `nittle sessions` and `nittle cleanup` read | yes |
| `~/.nittle/state.json` | user state: `lspOverrides`, the dismissed what's-new version, the launch update-check cache, a pending install migration | no |
| `~/.nittle/drafts/<hash>.json` | unsent comment drafts, one file per review | no |
| `~/.nittle/migration-conflicts/` | old review records that clashed with different ones during the diffle migration (`nittle doctor` lists them) | no |
| `~/.nittle/bin/nittle` (`nittle.exe` on Windows) | the installed binary | no (`NITTLE_INSTALL_DIR` moves it) |

Approved and cancelled Review Records stay on disk until you delete them. The first run moves an old `~/.diffle` or `~/.loupe` into `~/.nittle`. See [Migrating from diffle](/guides/migrating-from-diffle/).

## Language servers

| set with | scope | stored in |
| --- | --- | --- |
| `nittle lsp set <lang> "<command>"` | every run | `~/.nittle/state.json` under `lspOverrides` |
| `nittle lsp unset <lang>` | removes the stored override | |
| `--lsp <lang>=<command>` on `nittle` or `nittle show` | one run, repeatable, wins over a stored override | |
| `--no-lsp` | one run, no language servers at all | |

| rule | value |
| --- | --- |
| languages | `typescript`, `csharp`, `python`, `go`, `rust`, `vue`, `svelte` |
| disable a language | empty command: `nittle lsp set rust ""` or `--lsp rust=` |
| how the command runs | split on whitespace (quotes group), run directly with no shell, so pipes and `&&` reach the server as plain arguments |
| refused | a server that resolves inside the repository under review |

```sh
nittle lsp set python "basedpyright-langserver --stdio"
nittle --lsp rust=rust-analyzer --lsp go=
```

## Browser prefs

Display prefs live in the browser's `localStorage` under `nittle-<name>` keys. `localStorage` is per origin, and each launch picks a random port, so these reset between launches unless you pass the same `-p, --port` every time.

| key | values | default |
| --- | --- | --- |
| `nittle-theme` | `light`, `dark` | the OS color scheme |
| `nittle-split` | `true`, `false` | `false` (unified) |
| `nittle-split-ratio` | number | `50` |
| `nittle-wrap` | `true`, `false` | `false` |
| `nittle-view` | `single`, `all` | `all` |
| `nittle-file-order` | `tree`, `review` | `tree` |
| `nittle-sidebar` | width in px | |

The what's-new "seen" version and language server overrides are in `~/.nittle/state.json` instead, so they survive the port change.

## Legacy `.review` files

| behavior | detail |
| --- | --- |
| file list | a `.review` file at the repo root never shows in the diff or browse file list, in any mode. There is no toggle |
| prompt | when one exists, the review shows `A legacy .review file was found.` with Import, Remove and Ignore |
| Import | replaces the current Review Record's comments and viewed list with the file's; the file stays |
| Remove | deletes the file, after a confirm dialog |
| Ignore | hides the prompt for this page and leaves the file alone |
| git | when nittle writes one, it adds `.review` to `.git/info/exclude` (never `.gitignore`) |

## Files nittle never loads from the reviewed repo

nittle runs with the reviewed repository as its working directory, and does not read that repository's `.env` or `bunfig.toml`.

| path | how |
| --- | --- |
| installed binary | compiled with `--no-compile-autoload-dotenv`, `--no-compile-autoload-bunfig`, `--no-compile-autoload-tsconfig`, `--no-compile-autoload-package-json` |
| source checkout | `src/index.ts` and the MCP entry run under `bun --no-env-file` |
| review spawned by the stop hook | started with `--no-env-file` and nittle's own `bunfig.toml` |

A repo `.env` could otherwise set `NITTLE_*`, `VIRTUAL_ENV` or `PATH` for nittle, and a `bunfig.toml` `preload` would run the repo's code inside nittle.

## Update behavior

| step | detail |
| --- | --- |
| source | GitHub Releases |
| verify | SHA-256 against the release's `checksums.txt`; a mismatch aborts with `checksum mismatch for <asset>` |
| swap | replaces the binary; on Windows the running exe is renamed aside as `.nittle.exe.old*` and removed by a later update |
| MCP servers | stops servers still on the old binary, unless a review session is live; agents relaunch them on reconnect |
| package manager install | refuses and prints that manager's command |
| launch notice | one line when a newer release exists, checked at most once per 24 hours, off with `NITTLE_NO_UPDATE_CHECK` or `CI` |
| update badge | the open tab asks GitHub Releases every 10 minutes and shows a badge when a newer release exists, off with `NITTLE_NO_UPDATE_CHECK` |
| offline | checks fail quietly |
