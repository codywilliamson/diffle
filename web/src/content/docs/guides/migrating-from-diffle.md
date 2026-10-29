---
title: Migrating from diffle
description: nittle was called diffle. The first run of nittle moves an existing install over by itself.
sidebar:
  order: 9
---

nittle used to be called diffle (the Deterministic Inspection & Feedback Framework for Language-model Engineering, per ADR 0004, which we stand by), and before that loupe. The rename changed the command, the data directory, the plugin names and the environment variables. You don't have to do any of it by hand: the first time you run `nittle`, it migrates everything in one pass and then removes the diffle leftovers.

Installs from the loupe era migrate the same way.

## What the first run moves

The first run of the installed `nittle` binary handles each of these. The steps are independent, so one that fails is reported and the rest still run.

- Data. `~/.diffle` (or `~/.loupe`) moves to `~/.nittle`. With no `~/.nittle` yet, that's one rename. Otherwise the two merge: review records merge by id, and the copy already in `~/.nittle` wins. An old record that clashes with a different one is set aside in `~/.nittle/migration-conflicts/`, and nothing is deleted from the old directory until its copy reads back byte-identical. If you set `NITTLE_DATA_DIR` (or `DIFFLE_DATA_DIR`), your records stay where you pointed them and only the home-level state moves.
- The binary. The `nittle` binary is copied into `~/.nittle/bin` (or `NITTLE_INSTALL_DIR`) and checked by hash. The old `~/.diffle/bin` entry on your `PATH` is replaced with the new one. The diffle binary is deleted last, only once `nittle` is in place and on `PATH`, so you're never left with neither command. A copy installed by a package manager isn't moved.
- Agent plugins and MCP configs. Running diffle MCP servers are stopped first. In Claude Code and Codex, the `diffle-review` or `loupe-review` plugin is removed and `nittle-review` installed, through each agent's own CLI. Any agent MCP config entry that launches `diffle` or `loupe` is rewritten to launch `nittle`.
- Browser preferences. Settings saved under `diffle-*` keys move to `nittle-*` the first time the page reads them.

On Windows the `PATH` change is made to your user `PATH`, in place. On macOS and Linux, nittle edits only the old installer's own `# >>> diffle >>>` block in your shell profile. It copies the file to `<profile>.nittle.bak-<timestamp>` first, rewrites that block to the nittle one, and leaves every other line alone.

## When a step can't finish

Anything left over is printed with what's still in the way, and the next run tries again. Two cases come up most:

- The data move waits while an old diffle MCP server or review session is still running, since it could still write to `~/.diffle`. Close the agent session, then run `nittle` again.
- The plugin swap needs `claude` or `codex` on `PATH`. Without it, that agent is left for `nittle doctor`.

`nittle doctor` reports retired plugins, old MCP configs, a deferred data move and any records set aside in `migration-conflicts`. `nittle doctor --fix` runs the repairs:

```sh
nittle doctor
nittle doctor --fix
```

## Environment variables

`DIFFLE_*` variables are still read when the `NITTLE_*` one isn't set. nittle prints a one-time notice listing each one to rename, for example `DIFFLE_DATA_DIR -> NITTLE_DATA_DIR`, and shows it again only if the set changes. `LOUPE_*` variables are no longer read.

## After the first run

There's no `diffle` command anymore, so update scripts and aliases to call `nittle`. Start a new agent session (or run `/reload-plugins` in Claude Code) so the `nittle` MCP server replaces the old one.

To install fresh instead, see [Installation](/getting-started/installation/).
