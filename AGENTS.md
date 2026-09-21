# loupe — agent guide

Local git diff viewer for focused code review: review a diff, leave inline comments, export them as structured feedback. Run with `bun src/index.ts`. Full original spec: [`docs/prompt.md`](docs/prompt.md).

## Agent skills

### Issue tracker

Loupe development issues are tracked in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Loupe uses the default Matt Pocock skill label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Loupe uses a single-context domain model. See `docs/agents/domain.md`.

## Stack & hard constraints

- **Bun runs the backend**: server (`Bun.serve`), CLI, MCP runtime, `bun test`, and the standalone compiler. Server/core/MCP TypeScript executes directly — no build step there.
- **The client is a built Svelte SPA**: Svelte 5 runes + Vite + Tailwind v4 + shadcn-svelte. Source under `client/`, built to `dist/client` (served by `Bun.serve`). No SvelteKit. `bun run dev` runs the backend + Vite together with `/api` proxied to that backend; `bun start` / `bun run preview` serve the built client. The old buildless Preact client has been removed.
- **Runtime dependencies stay narrow and pinned.** The MCP SDK and its schema dependency are the intentional runtime deps; the Svelte/Vite/Tailwind/test tooling is dev-only and exact-pinned. Add a runtime package only when it replaces meaningful protocol or platform code.

## Engineering standards (enforced)

- **File size**: soft 150 lines, **hard 200** for server/core/MCP modules — split before you hit the cap. The Svelte client is not under a blanket line cap; Svelte components and client `.ts` modules split by responsibility (SRP). The D5 token/theme CSS is exempt.
- **DRY** — extract anything used twice. Shared helpers in `src/utils/` (server) or `client/src/lib/` (client).
- **SRP** — one job per module. If describing a file needs "and", split it.
- **KISS / YAGNI** — build exactly what's asked. Keep agent adapters thin and avoid speculative extension points.
- **Types** — strict TS, no `any` on the contract types.
- **Readability** — named constants over magic values; plain-English function names (`compileReviewPrompt`, `resolveRef`, `appendToGitignore`); comments lowercase, minimal, only when needed.

## The one architectural invariant

`src/types.ts` is the single source of truth for diff JSON, durable Review Records, the legacy `.review` shape, and API/MCP request bodies. **Nothing redefines these — import from `src/types.ts`.** The Svelte client imports them through the `$types` alias; it never re-declares a shape. Change shared shapes there first.

## Layout

- `src/index.ts` — CLI entry: parse the ref arg → run + parse the diff → serve → open browser.
- `src/core/` — diff parsing, prompt compilation, durable Review Records, and legacy `.review` import.
- `src/mcp/` — local stdio MCP server and its Review Record adapter.
- `src/server/` — `router` + `handlers` (`Bun.serve`). `GET /api/diff` re-runs git diff each call (live refresh).
- `src/utils/git.ts` — `runGit`, `resolveRef`.
- `client/` — Svelte 5 SPA (Vite root). `client/src/lib/` typed API adapters + state stores + diff transforms, `client/src/lib/components/` the UI, `client/src/styles/` D5 tokens/theme. Built to `dist/client`.
- `vite.config.ts` / `vitest.config.ts` / `playwright.config.ts` — client build, unit/component tests, e2e. `scripts/dev.ts` — the `bun run dev` launcher.
- `tests/` — `bun test` (server/core/MCP), fixtures in `tests/fixtures/`. `e2e/` — Playwright specs (`*.pw.ts`).

## Commits — Conventional Commits

`<type>(<scope>): <short lowercase description>`. Types: `feat` `fix` `test` `refactor` `chore` `docs` `style`. Scopes: `parser` `server` `ui` `client` `store` `compiler` `cli` `types` `tests`. One concern per commit; never batch unrelated changes.

## Testing & verification

- `bun test` covers server/core/MCP (scoped to `tests/` via `bunfig.toml`) — aim for full branch coverage on pure modules (`diffParser`, `promptCompiler`). Use fixtures for multi-line input; no fs mocking (temp dirs via `os.tmpdir()`).
- The client is tested with **Vitest + Testing Library** (`bun run client:test`) and **Playwright** e2e (`bun run test:e2e`, `.pw.ts`). Keep server `bun x tsc --noEmit` (strict) and client `bun run client:check` (svelte-check) both clean.
- MCP/plugin work also validates the MCPB manifest and both agent skills.
- **Green tests ≠ a working app.** The frontend is not covered by `bun test`. Verify UI changes in a real browser (both themes, desktop + phone) before calling them done. (A `<>` fragment bug once left the entire diff pane blank while all tests passed.)

## Releases

Semver from `0.1.0`. Patch = fixes/refactors/docs; minor = a new user-facing feature → bump `package.json`, tag `vX.Y.Z`, cut a GitHub release. Keep an `## [Unreleased]` section in `CHANGELOG.md`.
