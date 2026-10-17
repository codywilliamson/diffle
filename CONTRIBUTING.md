# Contributing to nittle

Use a recent Git and Bun 1.3.14. From a clone of this repository:

```sh
bun install --frozen-lockfile
bun run dev
```

Open the local URL printed by the server. If the client is blank, check the Vite and backend output in the terminal before opening a bug report.

## Check your change

Run the checks that cover your work before opening a pull request:

```sh
bun test
bun x tsc --noEmit
bun run client:check && bun run client:test
bun run test:e2e
```

The browser suite builds the client before running. It needs Playwright's Chromium installed (`bunx playwright install chromium`). On Windows, Playwright driven through Bun can hang; run the browser suite on Linux or use the pull request `e2e` job. See [AGENTS.md](AGENTS.md) for engineering standards and file size limits.

## Visual snapshots

`bun run test:e2e` runs the behavior specs only. The pixel snapshots live in `e2e/visual/` with baselines under `e2e/__snapshots__/`, and they are Linux-only: fonts and rasterizing differ per OS, so never commit a baseline made on Windows or macOS. CI runs them inside the pinned Playwright container (`mcr.microsoft.com/playwright:v<version>-noble`), and so does `bun run test:e2e:docker`, which needs Docker running.

When a snapshot fails, open the `visual-snapshot-failures` artifact on the run. It holds the actual, expected and diff image for each failure.

If the change is intended, regenerate the baselines in one of two ways:

- Run the `update-snapshots` workflow from the Actions tab with your PR branch as `ref`. It commits `test: update visual snapshots` to that branch. Commits pushed with the workflow token do not trigger checks, so push a follow-up commit or re-run `e2e` afterwards.
- Or run `bun run test:e2e:docker:update` locally and commit the changed PNGs.

Then look at the diff images in the PR before merging. A pull request must not change visual snapshots unless its description says why the pixels moved.

## Send a pull request

Follow the [code of conduct](CODE_OF_CONDUCT.md). Keep one concern per commit and rebase your branch on `main`. `main` requires checks and rebase merges. Use Conventional Commit headers (`type(scope): short description`); allowed types are listed in [.commit-guard.json](.commit-guard.json). To install the optional local guard hooks:

```sh
curl -fsSL https://raw.githubusercontent.com/codywilliamson/commit-guard/main/install.sh | COMMIT_GUARD_REF=v0.3.1 bash
```

Release Please handles versions, changelogs, tags, and releases. Do not bump versions by hand.
