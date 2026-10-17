---
title: Migrating from diffle
description: nittle was called diffle. The first run of nittle moves an existing install over by itself.
sidebar:
  order: 4
---

nittle used to be called diffle. The rename changed the command, the data directory, the plugin names and the environment variables. You don't have to do any of it by hand: the first time you run `nittle`, it migrates everything in one pass and then removes the diffle leftovers.

Installs from the loupe era are migrated too, so the same applies if you skipped diffle.

## What the first run moves

- The data directory. `~/.diffle` moves to `~/.nittle`, review records included. Nothing is deleted until it's confirmed at the new location.
- The install. The binary directory moves from `~/.diffle/bin` to `~/.nittle/bin`, and the old `PATH` entry is swapped for the new one.
- Agent plugins and MCP configs. The `diffle-review` plugin becomes `nittle-review`, and any `diffle` MCP server entry in your agents' configs is renamed to `nittle`.
- Browser preferences. Settings stored under `diffle-*` keys are carried over to `nittle-*`.

Your shell profile is left alone. If something can't be moved, nittle keeps both copies, prints exactly what is left, and tries again on the next run.

## Environment variables

`DIFFLE_*` variables are still read as a fallback, and nittle prints a one-time notice asking you to rename them. Use `NITTLE_*` going forward. `LOUPE_*` variables are no longer read.

## After the first run

There is no `diffle` command anymore, so update scripts and aliases to call `nittle`. Start a new agent session (or run `/reload-plugins` in Claude Code) so the `nittle` MCP server replaces the old one.

If a leftover plugin survives, `nittle doctor` finds it and `nittle doctor --fix` repairs it. To install fresh instead, see [Installation](/getting-started/installation/).
