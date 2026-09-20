# loupe — agent guide

Local git diff viewer for focused code review: review a diff, leave inline comments, export them as structured feedback. Run with `bun src/index.ts`. Full original spec: [`docs/prompt.md`](docs/prompt.md).

## Agent skills

### Issue tracker

Loupe development issues are tracked in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Loupe uses the default Matt Pocock skill label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Loupe uses a single-context domain model. See `docs/agents/domain.md`.

### Product demo capture

Polished demo videos come from a Playwright → Remotion pipeline (record clean, composite in post).
See `docs/agents/product-demo.md`.

## Stack & hard constraints

- **Bun is everything**: server (`Bun.serve`), tests (`bun test`), TypeScript executed directly. No build step, no bundler, no transpile.
- **Frontend is buildless**: Preact + htm + highlight.js loaded from a CDN (esm.sh) as ES modules. No JSX — htm tagged templates (`` html`...` ``).
  - The raw `htm.bind(h)` does **not** support the `<>...</>` fragment shorthand. Return multiple root nodes instead (htm yields an array, Preact renders siblings).
- **Runtime dependencies stay narrow and pinned.** The official MCP SDK and its schema dependency are intentional; add another runtime package only when it replaces meaningful protocol or platform code.

## Engineering standards (enforced)

- **File size**: soft 150 lines, **hard 200 — no file may exceed it**. `src/client/index.html` is exempt; the client `.js` modules are not. Split before you hit the cap.
- **DRY** — extract anything used twice. Shared helpers in `src/utils/` (server) or `src/client/util.js` (client).
- **SRP** — one job per module. If describing a file needs "and", split it.
- **KISS / YAGNI** — build exactly what's asked. Keep agent adapters thin and avoid speculative extension points.
- **Types** — strict TS, no `any` on the contract types.
- **Readability** — named constants over magic values; plain-English function names (`compileReviewPrompt`, `resolveRef`, `appendToGitignore`); comments lowercase, minimal, only when needed.

## The one architectural invariant

`src/types.ts` is the single source of truth for diff JSON, durable Review Records, the legacy `.review` shape, and API/MCP request bodies. **Nothing redefines these — import from `src/types.ts`.** Change shared shapes there first.

## Layout

- `src/index.ts` — CLI entry: parse the ref arg → run + parse the diff → serve → open browser.
- `src/core/` — diff parsing, prompt compilation, durable Review Records, and legacy `.review` import.
- `src/mcp/` — local stdio MCP server and its Review Record adapter.
- `src/server/` — `router` + `handlers` (`Bun.serve`). `GET /api/diff` re-runs git diff each call (live refresh).
- `src/utils/git.ts` — `runGit`, `resolveRef`.
- `src/client/` — buildless Preact modules; `src/types.ts` is the shared client/server contract.
- `tests/` — `bun test`, fixtures in `tests/fixtures/`.

## Commits — Conventional Commits

`<type>(<scope>): <short lowercase description>`. Types: `feat` `fix` `test` `refactor` `chore` `docs` `style`. Scopes: `parser` `server` `ui` `store` `compiler` `cli` `types` `tests`. One concern per commit; never batch unrelated changes.

## Testing & verification

- `bun test` — aim for full branch coverage on the pure modules (`diffParser`, `promptCompiler`). Use fixtures for multi-line input; no fs mocking (use temp dirs via `os.tmpdir()`).
- `bun x tsc --noEmit` (strict) must stay clean.
- MCP/plugin work also validates the MCPB manifest and both agent skills.
- **Green tests ≠ a working app.** The buildless frontend is not covered by `bun test`. Verify UI changes in a real browser before calling them done. (A `<>` fragment bug once left the entire diff pane blank while all 48 tests passed.)

## Releases

Semver from `0.1.0`. Patch = fixes/refactors/docs; minor = a new user-facing feature → bump `package.json`, tag `vX.Y.Z`, cut a GitHub release. Keep an `## [Unreleased]` section in `CHANGELOG.md`.
