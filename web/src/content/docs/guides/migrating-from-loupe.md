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

## Distribution changed

The old install was `git clone` + `bun link`. The new path is the one-command installer plus `diffle update` — see [Installation](/getting-started/installation/).

## What to update

- Switch scripts and aliases to `diffle`.
- Move any `LOUPE_*` env vars to `DIFFLE_*` at your convenience.
- Re-point installs to the installer.

The compatibility shims will be removed in a future release.
