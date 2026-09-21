---
title: CLI Reference
description: Every diffle command, argument, and option for reviewing git diffs in the browser.
sidebar:
  order: 1
---

diffle reviews whichever git repo you run it from. Each command prints a `http://localhost:<port>` URL and opens it in your browser — the diff renders there, not in the terminal.

## Commands

### `diffle`

Review the working tree against `HEAD`, including untracked files.

```sh
diffle
```

### `diffle staged`

Review staged changes only.

```sh
diffle staged
```

### `diffle <branch>`

Review the current branch against the named branch, using a PR-style three-dot comparison.

```sh
diffle main
```

### `diffle <ref1>..<ref2>`

Review a commit range.

```sh
diffle v0.1.0..HEAD
```

### `diffle browse [path]`

Review the whole codebase, optionally scoped to a path.

```sh
diffle browse
diffle browse src/server
```

### `diffle mcp serve`

Run the local MCP server for agent integrations. See [MCP tools](/reference/mcp-tools/).

```sh
diffle mcp serve
```

### `diffle hook stop --agent <codex|claude-code>`

Completion-hook entry used by the agent integrations.

```sh
diffle hook stop --agent codex
diffle hook stop --agent claude-code
```

### `diffle sessions`

List running diffle sessions with their host, port, age, and live/stale status.

```sh
diffle sessions
```

### `diffle cleanup [--yes] [--all]`

Stop stale sessions and finished reviews. `--yes` skips the confirmation; `--all` also stops active sessions.

```sh
diffle cleanup
diffle cleanup --yes
diffle cleanup --all --yes
```

### `diffle update`

Download and install the latest release. It verifies the download's SHA-256 and refuses when a package manager owns the install. See [Configuration](/reference/configuration/) for the full update behavior.

```sh
diffle update
```

## Options

| flag | meaning |
| --- | --- |
| `-p, --port <n>` | serve on a fixed port (default: any free port) |
| `--no-open` | don't open the browser automatically |
| `--review-id <id>` | open an existing durable Review Record |
| `-v, --version` | print the installed version |
| `-h, --help` | show help |

## The `loupe` alias

The deprecated `loupe` command is an alias for `diffle` during the compatibility window. See [Migrating from loupe](/guides/migrating-from-loupe/).
