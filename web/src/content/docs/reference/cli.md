---
title: CLI reference
description: Every nittle command, subcommand and flag, with real help output, examples and exit codes.
sidebar:
  order: 1
---

Every command takes `-h, --help`, `-v, --version` and `--license`. `nittle --help` lists all commands, and `nittle <command> --help` prints that command's options. A command run with a flag it doesn't accept exits 1 before doing anything.

## Commands

| command | does |
| --- | --- |
| [`nittle [ref]`](#nittle-ref) | review a diff in the browser (the default command) |
| [`nittle show [rev]`](#nittle-show) | review one commit against its first parent |
| [`nittle mcp serve`](#nittle-mcp-serve) | run the local stdio MCP server (agents launch this) |
| [`nittle mcp list`](#nittle-mcp-list) | list running MCP servers |
| [`nittle mcp restart`](#nittle-mcp-restart) | stop running MCP servers so agents relaunch them on reconnect |
| [`nittle setup`](#nittle-setup) | wire nittle into your coding agents (plugin or MCP config) |
| [`nittle doctor`](#nittle-doctor) | check agent plugin installs, leftover migrations and the release channel |
| [`nittle update`](#nittle-update) | download and install the latest release |
| [`nittle lsp`](#nittle-lsp) | show which language server each language gets, and override it |
| [`nittle sessions`](#nittle-sessions) | list running review sessions |
| [`nittle cleanup`](#nittle-cleanup) | stop stale sessions and finished reviews |
| [`nittle completion`](#nittle-completion) | print a tab-completion script for your shell |
| [`nittle hook stop`](#nittle-hook-stop) | agent stop hook that keeps a review open until it is resolved |

## Errors and exit codes shared by every command

| exit | when | stderr |
| --- | --- | --- |
| `0` | the command finished | |
| `1` | bad arguments, or the command failed | `[nittle] <message>` |

Argument errors, verbatim from the parser:

| input | message |
| --- | --- |
| `nittle --bogus` | `unknown option: --bogus (try --help)` |
| `nittle cleanup extra` | `unexpected argument: extra (cleanup accepts options only)` |
| `nittle show a b` | `unexpected argument: b (only one ref spec, try --help)` |
| `nittle --port 0` | `--port needs a number between 1 and 65535 (got 0)` |
| `nittle --json` | `--json needs --wait` |
| `nittle --review-id` | `--review-id needs an id` |
| `nittle mcp` | `mcp requires one of: serve, list, restart` |
| `nittle hook` | `hook requires the stop command` |

Commands that ask `Proceed? [y/N]` (`setup`, `doctor --fix`, `mcp restart`, `cleanup`) print `pass --yes to proceed` and exit 1 when stdin is not a terminal.

## `nittle [ref]`

Review a diff in the browser. It prints a `http://127.0.0.1:<port>` URL and opens it. The server only binds to `127.0.0.1`.

```text
Usage
  nittle [ref] [options]
  nittle --wait [ref] [--json]
```

| ref | compares |
| --- | --- |
| (none) | working tree vs `HEAD`, untracked files included |
| `staged` | staged changes only |
| `<branch>` | current branch vs `<branch>` (PR-style three-dot) |
| `<ref1>..<ref2>` | commit range |
| `browse [path]` | the whole codebase, optionally scoped to a path (no diff, no scorecard) |

| flag | value | effect |
| --- | --- | --- |
| `-p, --port` | `<n>`, 1 to 65535 | serve on a fixed port (default: any free port) |
| `--no-open` | | don't open the browser automatically |
| `--wait` | | block until feedback is returned, then print the prompt on stdout |
| `--json` | | with `--wait`, print the review record as JSON instead of the prompt |
| `--no-lsp` | | start no language servers |
| `--lsp` | `<lang>=<command>`, repeatable | use this server for one language this run; an empty command disables it |
| `--review-id` | `<id>` | open an existing durable Review Record (its stored repo and comparison win over a `ref` argument) |

```text
$ nittle HEAD~1 --no-open --no-lsp
[nittle] v0.32.1 — reviewing worktree-docs-launch → HEAD~1 (7 files changed)
  http://127.0.0.1:33138/?review=128b4692-9962-465b-970a-7b319730e24f  (ctrl+c to stop)
[nittle] 72 stale sessions — run nittle cleanup
```

Startup also prints one-line notices when they apply: a newer release (`NITTLE_NO_UPDATE_CHECK=1` silences it), a stale legacy plugin (`run nittle doctor`), or stale sessions (`run nittle cleanup`).

| error | cause |
| --- | --- |
| `not a git repository (run nittle inside one)` | the cwd is not inside a git repo |
| `unknown ref: <ref>` | git can't resolve the ref |
| `review record not found` | `--review-id` names a record that doesn't exist |
| `port <n> is already in use` | `--port` is taken |
| `--lsp needs <lang>=<command> (an empty command disables the language)` | `--lsp` without `=` |
| `unknown language "<lang>" (one of: typescript, csharp, python, go, rust, vue, svelte)` | `--lsp` names an unknown language |

### `--wait` and `--json`

`--wait` blocks until the reviewer returns feedback, approves or cancels. Status lines go to stderr, the result goes to stdout. With `--json`, stdout is the [`get_review`](/reference/mcp-tools/#get_review) JSON for feedback, approved and cancelled.

| exit | outcome | stdout without `--json` | stdout with `--json` |
| --- | --- | --- | --- |
| `0` | feedback returned | the compiled prompt | `get_review` JSON |
| `0` | review approved | empty | `get_review` JSON |
| `2` | review cancelled | empty | `get_review` JSON |
| `3` | last tab closed without returning feedback (after a grace of about 5 s) | empty | empty |
| `4` | session stopped from outside, for example by `nittle cleanup`; the review stays open | empty | empty |
| `130` | interrupted (ctrl+c) while waiting; the review stays open | empty | empty |
| `1` | error | empty | empty |

On `3`, `4` and `130`, stderr carries the resume line: `review <id> is still open. resume with: nittle --review-id <id> (or get_review over MCP)`.

```sh
nittle --wait > feedback.md; echo "exit $?"
```

## `nittle show`

Review one commit. With no rev it reviews `HEAD`. It is the same diff as `nittle <rev>^!`, with the commit's short hash, subject, body, author and date above the files. A root commit is compared with the empty tree, a merge commit with its first parent. The review is pinned to the full hash, so reopening it shows the same diff after `HEAD` moves, as long as the commit still exists (a rebase plus gc removes it).

```text
Usage
  nittle show [rev] [options]
```

| flag | value | effect |
| --- | --- | --- |
| `-p, --port` | `<n>` | serve on a fixed port |
| `--no-open` | | don't open the browser automatically |
| `--no-lsp` | | start no language servers |
| `--lsp` | `<lang>=<command>`, repeatable | one-run language server override |

`show` does not take `--wait`, `--json` or `--review-id`.

```sh
nittle show HEAD~2
```

| error | cause |
| --- | --- |
| `unknown commit: <rev>` | git can't resolve the rev |
| `show takes one commit, not a range or revision set: <rev>` | a range such as `a..b` |
| `invalid commit: <rev> (a commit can't start with "-")` | rev starts with `-` |
| `<hash> is at the edge of a shallow clone, so its parent isn't here. fetch it with: git fetch --deepen=1` | shallow clone |

## `nittle mcp serve`

Run the local stdio MCP server named `nittle`. Agents launch it from their MCP config, so you rarely run it by hand. A `start_review` call may only target a `cwd` inside `NITTLE_ROOT`, or inside the directory the server was started from when that is unset. Tools: [MCP tools](/reference/mcp-tools/).

| flag | effect |
| --- | --- |
| none | |

```sh
nittle mcp serve
```

## `nittle mcp list`

List running nittle MCP servers.

| flag | effect |
| --- | --- |
| none | |

```text
$ nittle mcp list
no nittle MCP servers running
```

With servers running it prints a `PID  PATH` table.

## `nittle mcp restart`

Stop every running nittle MCP server so agents relaunch it, for example on a new binary. Agents don't respawn a stopped server by themselves: reconnect in Claude Code with `/mcp`, or start a new session.

| flag | effect |
| --- | --- |
| `--yes` | skip the confirmation prompt |

```sh
nittle mcp restart --yes
```

| exit | when | output |
| --- | --- | --- |
| `0` | servers stopped, or none running | `stopped 2 MCP servers — agents start the new server on reconnect (Claude Code: /mcp → reconnect, or a new session)` |
| `1` | a review session is live | `1 live review session — finish or stop them first (nittle sessions / cleanup --all)` |
| `1` | a server could not be stopped | `failed to stop:` then each pid |

## `nittle setup`

Wire nittle into your coding agents. It detects installed agents (binary on `PATH` or config directory present), shows a checklist with detected agents first and pre-checked (`↑↓` move, `space` select, `a` all, `enter` confirm), prints every command and file it will touch, then asks `Proceed? [y/N]`. Re-running reports `unchanged`. `--remove` pre-checks the agents nittle is set up in, tagged `(set up)`.

```text
Usage
  nittle setup [--remove] [--agents <ids>] [--yes]
```

| flag | value | effect |
| --- | --- | --- |
| `--agents` | comma-separated ids | act on these agents and skip the checklist |
| `--remove` | | unwire nittle instead |
| `--yes` | | skip the confirmation prompt |

Agent ids: `claude`, `codex`, `cursor`, `gemini`, `vscode`, `windsurf`, `opencode`, `zed`, `copilot`.

```sh
nittle setup --agents claude,cursor --yes
```

| exit | when |
| --- | --- |
| `0` | done, or nothing selected |
| `1` | a step failed |
| `1` | no terminal and no `--agents`: `no terminal to prompt in — pass --agents <ids> (detected: ...)` |
| `1` | an unknown id: `unknown agent: nope (valid: claude, codex, cursor, gemini, vscode, windsurf, opencode, zed, copilot)` |
| `1` | `--remove` left a set-up agent in place (unchecked, or its CLI is missing) |
| `130` | the checklist or the confirmation was cancelled |
| `130` | `--remove` with nothing checked while agents are still set up |

The uninstaller relies on a non-zero exit to keep the binary when a teardown is unfinished.

## `nittle doctor`

Report what's wrong with the agent plugin installs and what to run to fix it. It checks the Claude Code plugin and marketplace for stale `diffle-review` or `loupe-review` leftovers, the other agents' retired plugins and MCP configs, a data migration that hasn't finished, old review records parked under `migration-conflicts/`, whether `nittle` is on `PATH`, and whether a newer release is published (skipped with `NITTLE_NO_UPDATE_CHECK`).

```text
Usage
  nittle doctor [--fix] [--yes]
```

| flag | effect |
| --- | --- |
| `--fix` | run the repair commands (Claude Code repairs go through the `claude` CLI) |
| `--yes` | skip the confirmation prompt; also passes `--yes` to `claude plugin install` |

```text
$ nittle doctor
nittle doctor — agent plugin health (C:\Users\Cody\.claude)

  OK    legacy plugins         no diffle-review / loupe-review plugin installed
  OK    legacy plugin enabled  none enabled
  OK    legacy marketplace     none registered
  OK    marketplace source     not registered
  OK    legacy MCP server      no `diffle` server wired
  WARN  nittle-review          not installed
  OK    release                v0.32.1 is the latest

To repair, run:
  claude plugin marketplace add codywilliamson/nittle
  claude plugin install nittle-review@nittle-local --scope user

or let nittle run them: nittle doctor --fix
```

| exit | when |
| --- | --- |
| `0` | healthy, or `--fix` finished every repair |
| `1` | something is unhealthy (without `--fix`), or a repair is incomplete (`repairs incomplete:` lists which) |

## `nittle update`

Download the latest release from GitHub Releases, verify its SHA-256 against `checksums.txt`, and swap the binary. Then it stops idle MCP servers still on the old binary (not while a review session is live) and prints the next steps that apply. On Windows the running exe is renamed aside as `.nittle.exe.old*` and removed by a later update.

```text
Usage
  nittle update [--check]
```

| flag | effect |
| --- | --- |
| `--check` | only report whether a newer release exists; never downloads, and works in a source checkout |

```text
$ nittle update --check
[nittle] v0.32.1 is the latest release (source checkout — use git pull)
```

An installed binary prints `v0.32.1 is the latest release`, or `v0.33.0 available (installed v0.32.1) — run nittle update`.

| output | when | exit |
| --- | --- | --- |
| `already on the latest release (v0.32.1).` | up to date | `0` |
| `installed via <manager> — update with: <command>` | a package manager owns the install | `0` |
| `'update' applies to an installed nittle binary; in a source checkout, use git pull.` | run from source | `0` |
| `could not reach GitHub to check for releases` | `--check` offline | `0` |
| `checksum mismatch for <asset>` | the download doesn't match `checksums.txt` | `1` |
| `download failed (<status>) for <url>` | the download failed | `1` |

An installed binary also announces a newer release in one line when a review launches, checking GitHub at most once every 24 hours. `NITTLE_NO_UPDATE_CHECK=1` or `CI` turns that off.

## `nittle lsp`

Print the language server each language gets, or store an override in `~/.nittle/state.json`. Commands run directly, never through a shell. When `VIRTUAL_ENV` is set, its `bin` (`Scripts` on Windows) is searched first for Python. Details: [Configuration](/reference/configuration/#language-servers).

```text
Usage
  nittle lsp
  nittle lsp set <lang> <command>
  nittle lsp unset <lang>
```

| subcommand | effect |
| --- | --- |
| (none) | one line per language: the server that will run, or what was tried and how to install it; stored overrides follow the table |
| `set <lang> <command>` | always use `<command>` for `<lang>`; quote a command with arguments; `""` disables the language |
| `unset <lang>` | drop the stored override |

Languages: `typescript`, `csharp`, `python`, `go`, `rust`, `vue`, `svelte`.

```text
$ nittle lsp
typescript  not on PATH (tried typescript-language-server)  npm install -g typescript-language-server typescript
csharp      not on PATH (tried roslyn-language-server, csharp-ls)  dotnet tool install -g roslyn-language-server --prerelease (or: dotnet tool install -g csharp-ls)
python      not on PATH (tried pyrefly, basedpyright-langserver)  pip install pyrefly (or: pip install basedpyright)
go          C:\Users\Cody\go\bin\gopls.exe
rust        not on PATH (tried rust-analyzer)  rustup component add rust-analyzer
vue         not on PATH (tried vue-language-server)  npm install -g @vue/language-server
svelte      not on PATH (tried svelteserver)  npm install -g svelte-language-server
```

```text
$ nittle lsp set python "basedpyright-langserver --stdio"
[nittle] python: set to basedpyright-langserver --stdio
```

| error | cause |
| --- | --- |
| `lsp set needs a language and a command, e.g. lsp set python "pyrefly lsp" ("" disables it)` | `set` without a command |
| `unexpected argument: <word> (quote a command that has arguments)` | an unquoted command with arguments |
| `unknown language "<lang>" (one of: typescript, csharp, python, go, rust, vue, svelte)` | unknown language |
| `unterminated " in command: <command>` | unbalanced quote |

## `nittle sessions`

List review sessions from the session registry.

| flag | effect |
| --- | --- |
| none | |

```text
$ nittle sessions
REVIEW                                STATUS          HOST  PORT   AGE  STATE
41462557-210f-46c4-b33d-6fb1fb7e0e38  awaiting_human  cli   13806  13h  stale
f760979b-deb4-4ce2-8626-59e5894fc334  cancelled       mcp   21473  12d  stale
```

| column | values |
| --- | --- |
| `STATUS` | the Review Record status (`awaiting_human`, `feedback_ready`, `approved`, `cancelled`), or `missing` |
| `HOST` | what launched it: `cli`, `mcp` or `hook` |
| `AGE` | `just now`, `<n>m`, `<n>h`, `<n>d` |
| `STATE` | `live` (server answering) or `stale` (process gone) |

With nothing registered it prints `no nittle sessions`.

## `nittle cleanup`

Delete stale registry entries, stop live sessions whose review is approved, cancelled or missing, and remove leftover language server worktrees for the current repository. It prints the plan, then asks.

```text
Usage
  nittle cleanup [--yes] [--all]
```

| flag | effect |
| --- | --- |
| `--yes` | skip the confirmation prompt |
| `--all` | also stop active (not just finished or stale) sessions |

```sh
nittle cleanup --all --yes
```

| exit | when |
| --- | --- |
| `0` | done, nothing to do (`no nittle sessions`), or you answered no |
| `1` | a session could not be stopped (`failed to stop:` lists it) |

Run it from inside the repository to catch its leftover worktrees.

## `nittle completion`

Print a tab-completion script on stdout. It completes commands, subcommands (`mcp serve|list|restart`, `hook stop`, `lsp set|unset`), flags, enumerable flag values (`--shell`, `--agent`, `--agents`), and branch, remote and tag names for the review and `show` commands. Refs are read from git when you press tab. nittle never edits your shell profile; the installer can offer to.

```text
Usage
  nittle completion --shell <bash|zsh|fish|powershell>
```

| flag | value | effect |
| --- | --- | --- |
| `--shell` | `bash`, `zsh`, `fish`, `powershell` | shell to generate for (required) |

| shell | add to your profile |
| --- | --- |
| bash (`~/.bashrc`) | `eval "$(nittle completion --shell bash)"` |
| zsh (`~/.zshrc`, after `compinit`) | `source <(nittle completion --shell zsh)` |
| zsh (on demand) | `nittle completion --shell zsh > ~/.zfunc/_nittle` with `~/.zfunc` on `$fpath` before `compinit` |
| fish (`~/.config/fish/config.fish`) | `nittle completion --shell fish \| source`, or save the output as `~/.config/fish/completions/nittle.fish` |
| PowerShell (`$PROFILE`) | `nittle completion --shell powershell \| Out-String \| Invoke-Expression` |

| error | cause |
| --- | --- |
| `completion needs --shell bash\|zsh\|fish\|powershell` | no `--shell` |
| `--shell must be one of: bash, zsh, fish, powershell` | unknown shell |

## `nittle hook stop`

Stop-hook entry the Claude Code and Codex integrations call when the agent finishes a turn. It reads the hook JSON (`cwd`, `session_id`, `task_id`, `last_assistant_message`) from stdin. If that agent session already has an active review, it says so. Otherwise, when the repo has changes, it creates a Review Record with policy `required` and spawns `nittle --review-id <id>` in the background. It always prints one JSON line with a `systemMessage` and never fails the hook.

```text
Usage
  nittle hook stop --agent <codex|claude-code>
```

| flag | value | effect |
| --- | --- | --- |
| `--agent` | `codex` or `claude-code` | the agent calling the hook (required) |

```sh
echo '{"cwd":"/home/me/app","session_id":"s1"}' | nittle hook stop --agent claude-code
```

```json
{"systemMessage":"Nittle Review 3f2c9a1e-... opened. Resume after reviewing, or explicitly continue without waiting."}
```

| `systemMessage` | when |
| --- | --- |
| `Nittle Review <id> is still active.` | that agent session already has an open review |
| `Nittle Review <id> opened. Resume after reviewing, or explicitly continue without waiting.` | a new review was created |
| (no output) | the repo has no changes |
| `Nittle Review was not opened: <message>` | anything failed |

| env | effect |
| --- | --- |
| `NITTLE_NO_OPEN=1` | the spawned review doesn't open a browser |
| `NITTLE_HOOK_NO_SPAWN=1` | create the record but spawn no review process |

Missing `--agent` exits 1 with `hook stop requires --agent codex or claude-code`.

## Old command names

There is no `diffle` or `loupe` alias. The binary is `nittle`, and the first run moves an older install over. See [Migrating from diffle](/guides/migrating-from-diffle/).
