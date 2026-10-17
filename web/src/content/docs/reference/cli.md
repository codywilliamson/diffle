---
title: CLI Reference
description: Every nittle command, argument, and option for reviewing git diffs in the browser.
sidebar:
  order: 1
---

nittle reviews whichever git repo you run it from. Each command prints a `http://127.0.0.1:<port>` URL and opens it in your browser — the diff renders there, not in the terminal.

## Getting help

`nittle --help` prints an overview with common tasks and examples. Every command also takes `--help` (or `-h`) for its own options, examples, and related commands:

```sh
nittle update --help
nittle mcp --help
nittle setup -h
```

## Commands

### `nittle`

Review the working tree against `HEAD`, including untracked files.

```sh
nittle
```

### `nittle staged`

Review staged changes only.

```sh
nittle staged
```

### `nittle <branch>`

Review the current branch against the named branch, using a PR-style three-dot comparison.

```sh
nittle main
```

### `nittle <ref1>..<ref2>`

Review a commit range.

```sh
nittle v0.1.0..HEAD
```

### `nittle browse [path]`

Review the whole codebase, optionally scoped to a path.

```sh
nittle browse
nittle browse src/server
```

### `nittle mcp serve`

Run the local MCP server for agent integrations. See [MCP tools](/reference/mcp-tools/).

```sh
nittle mcp serve
```

### `nittle mcp list`

List running nittle MCP servers (pid and binary path).

```sh
nittle mcp list
```

### `nittle mcp restart [--yes]`

Stop every running nittle MCP server so your agent relaunches it, e.g. on the new binary after an update. Agents don't respawn a stopped stdio server by themselves: in Claude Code, reconnect it from `/mcp` or start a new session. It refuses while a review session is live, since a review can be hosted inside an MCP server; stale sessions don't block it. `--yes` skips the confirmation.

```sh
nittle mcp restart
nittle mcp restart --yes
```

### `nittle setup [--remove] [--agents <id,id>] [--yes]`

Wire nittle into your coding agents. It detects installed agents (binary on `PATH` or config directory present), shows a checkbox list (`↑↓` move, `space` select, `a` all, `enter` confirm) with detected agents first and pre-checked, prints every command and file it will touch, and asks `Proceed? [y/N]` before applying. It's idempotent: re-running reports `unchanged`. See [Agent feedback](/guides/agent-feedback/).

`--remove` reverses the setup. Its list starts with every agent nittle is currently set up in, tagged `(set up)` and pre-checked, so pressing enter removes them all; unchecking one leaves it set up and exits non-zero (so the uninstaller keeps the binary). `--agents` selects agents non-interactively and `--yes` skips the confirmation. Without a terminal and without `--agents`, it exits 1 with a hint.

```sh
nittle setup
nittle setup --agents claude,codex --yes
nittle setup --remove
```

Agent ids: `claude`, `codex`, `cursor`, `gemini`, `vscode`, `windsurf`, `opencode`, `zed`, `copilot`.

### `nittle hook stop --agent <codex|claude-code>`

Completion-hook entry used by the agent integrations.

```sh
nittle hook stop --agent codex
nittle hook stop --agent claude-code
```

### `nittle sessions`

List running nittle sessions with their host, port, age, and live/stale status.

```sh
nittle sessions
```

### `nittle cleanup [--yes] [--all]`

Stop stale sessions and finished reviews. `--yes` skips the confirmation; `--all` also stops active sessions.

```sh
nittle cleanup
nittle cleanup --yes
nittle cleanup --all --yes
```

### `nittle update [--check]`

Download and install the latest release. It verifies the download's SHA-256 and refuses when a package manager owns the install. After installing, it stops MCP servers still running the old binary (the same as `nittle mcp restart`) as long as no review session is live; otherwise it tells you to run `nittle mcp restart` later. It ends with a numbered list of the next steps that apply to you: restart any open review (it still runs the old version), reconnect your agents if their MCP servers were stopped (Claude Code: `/mcp` → reconnect, or a new session), run `nittle mcp restart` once live reviews finish if they blocked it, and confirm with `nittle --version` in a new shell. On Windows a copy of the old binary still held by a running MCP server can't be deleted, so it is retired under a unique name and cleaned up by a later update. `--check` only reports whether a newer release exists and never downloads; it also works in a source checkout. See [Configuration](/reference/configuration/) for the full update behavior.

```sh
nittle update
nittle update --check
```

An installed binary also announces a newer release in one line when a review launches, checking GitHub at most once a day. Set `NITTLE_NO_UPDATE_CHECK=1` to silence it (it's also skipped when `CI` is set).

### `nittle doctor [--fix] [--yes]`

Check the Claude Code plugin install for stale `diffle-review` or `loupe-review` leftovers and report what to repair. It also reports whether a newer release is published. `--fix` runs the repair commands through the `claude` CLI; `--yes` skips the confirmation. See [Migrating from diffle](/guides/migrating-from-diffle/).

```sh
nittle doctor
nittle doctor --fix
```

## Options

| flag | meaning |
| --- | --- |
| `-p, --port <n>` | serve on a fixed port (default: any free port) |
| `--no-open` | don't open the browser automatically |
| `--review-id <id>` | open an existing durable Review Record |
| `-v, --version` | print the installed version |
| `--license` | print the bundled MIT license notice |
| `-h, --help` | show help |

## Old command names

There is no `diffle` or `loupe` alias. The binary is `nittle`, and the first run moves an older install over. See [Migrating from diffle](/guides/migrating-from-diffle/).
