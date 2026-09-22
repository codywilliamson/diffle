---
title: Migrating from loupe
description: What changes when you move from loupe to diffle, and the one-release compatibility window.
sidebar:
  order: 4
---

diffle was formerly **loupe**. To ease the rename, diffle keeps a one-release compatibility window so existing setups keep working while you migrate.

## Compatibility shims

- The `loupe` command still works as a deprecated alias for `diffle`.
- `LOUPE_*` environment variables are still honored — prefer `DIFFLE_*`.
- **Data directory**: new installs use `~/.diffle`. If you already have `~/.loupe` and no `~/.diffle`, diffle keeps using `~/.loupe` in place — nothing is copied or deleted, so existing Review Records stay discoverable.
- Browser preferences stored under `loupe-*` localStorage keys are migrated to `diffle-*` on first read.

## Stale `loupe-review` plugin

If you installed the old Claude Code plugin, it is still registered as `loupe-review@loupe-local` and its `.mcp.json` still runs `loupe mcp serve` — so your agent's tools are still named `mcp__plugin_loupe-review_loupe__*` and the `diffle` server never appears. The diffle marketplace no longer contains the old plugin names, so refreshing the old marketplace breaks the install instead of migrating it.

Check for it:

```sh
diffle doctor
```

Repair it:

```sh
diffle doctor --fix
```

That drives the `claude` CLI for you. To do it by hand:

```sh
claude plugin uninstall loupe-review@loupe-local
claude plugin uninstall loupe-review-hook@loupe-local
claude plugin marketplace remove loupe-local
claude plugin marketplace add codywilliamson/diffle
claude plugin install diffle-review@diffle-local --scope user
```

Either way, start a new Claude Code session (or run `/reload-plugins`) afterwards so the `diffle` MCP server replaces `loupe`.

## Distribution changed

The old install was `git clone` + `bun link`. The new path is the one-command installer plus `diffle update` — see [Installation](/getting-started/installation/).

## What to update

- Switch scripts and aliases to `diffle`.
- Move any `LOUPE_*` env vars to `DIFFLE_*` at your convenience.
- Re-point installs to the installer.

The compatibility shims will be removed in a future release.
