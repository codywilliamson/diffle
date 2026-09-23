# Contributing to diffle

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

## Send a pull request

Follow the [code of conduct](CODE_OF_CONDUCT.md). Keep one concern per commit and rebase your branch on `main`. `main` requires checks and rebase merges. Use Conventional Commit headers (`type(scope): short description`); allowed types are listed in [.commit-guard.json](.commit-guard.json). To install the optional local guard hooks:

```sh
curl -fsSL https://raw.githubusercontent.com/codywilliamson/commit-guard/main/install.sh | COMMIT_GUARD_REF=v0.3.1 bash
```

Release Please handles versions, changelogs, tags, and releases. Do not bump versions by hand.
