# Rename diffle to nittle

moritzwilksch/diffle had the name first and launched it on Show HN, so the two tools now collide in search, in package names, and in every "which diffle?" thread ([#126](https://github.com/codywilliamson/diffle/issues/126)). We rename the product to **nittle**, nit + le, a tool for nitpicking diffs. The decision is made and the rename is under way as epic #206. The previous rename (ADR 0004, loupe to diffle) stands as written, backronym included.

Availability was checked on 2026-10-16: `nittle` is free on npm, crates.io, and GitHub, and `nittle.dev` is registered on Cloudflare. These checks are time-sensitive. Claim the package names before the first nittle release.

## Compatibility consequences

ADR 0004 kept a deprecated alias and a compatibility window. This rename does not. Nothing diffle-named stays on as a long-lived alias, and the first run migrates and cleans up.

- The binary is `nittle`. There is no `diffle` command and no `loupe` command.
- The first run of nittle from a diffle install migrates everything in one pass: the data dir, the install dir, the PATH entry, agent plugins and MCP configs, and browser prefs. Each step is an idempotent, injectable-path step under `src/core/migration/`, run in order at CLI startup.
- Data is moved, not copied, and never deleted before it is confirmed at the new location. `~/.diffle` is renamed to `~/.nittle` in one step. If `~/.nittle` already exists, review records merge by ID without overwriting, then `~/.diffle` is removed. If anything fails partway, both dirs stay, nittle prints exactly what is left, and the next run retries.
- `DIFFLE_*` environment variables are read as a fallback when the `NITTLE_*` name is unset, with a one-time notice listing which to rename. `LOUPE_*` is dropped.
- Shell profiles are never edited. The one exception is the installer's own PATH marker block.
- The one diffle-named thing that survives is the release asset `diffle-<os>-<arch>`, which is the nittle binary under its old name. It lets `diffle update` on 0.28.x find a working release. It keeps publishing for a fixed number of releases, set by a named constant in the release script.
- Proof is the upgrade smoke job on Linux, macOS, and Windows: after `diffle update` from 0.28.x, a fresh shell finds `nittle` on PATH, and no file, directory, PATH entry, or agent config named diffle remains.

Historical CHANGELOG entries, ADR 0004, and the other diffle-era ADRs are left alone. The planning docs under `docs/nittle/` (moved from `docs/diffle/`) carry a one-line note that they were written under the old name.

## External steps

The repo slug stays `codywilliamson/diffle` until the GitHub repo is renamed, which is a manual step (#214). GitHub redirects the old URLs afterwards. `PRODUCT.repository` flips to the new slug at that point, and badges and marketplace commands follow. Registry claims and Cloudflare changes (point nittle.dev at the docs site, redirect diffle.dev) are also manual and tracked in `docs/nittle/handoff.md`.
