# diffle — agent guide

Local git diff viewer for focused code review: review a diff, leave inline comments, export them as structured feedback (or hand it to an agent over MCP). Run from source with `bun start` (built client) or `bun run dev` (Vite); the installed command is `diffle`. Full original spec: [`docs/prompt.md`](docs/prompt.md).

> **Rebranded loupe → diffle.** One product config (`src/core/product.ts`) is the single identity source. A deprecated `loupe` command alias, legacy `LOUPE_*` env vars, and an existing `~/.loupe` data dir are supported for one release — **keep that compatibility working** until it's intentionally removed (Phase 9). See [`docs/diffle/handoff.md`](docs/diffle/handoff.md) for the current phase state.

## Agent skills

### Issue tracker

diffle development issues are tracked in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

diffle uses the default Matt Pocock skill label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

diffle uses a single-context domain model. See `docs/agents/domain.md`.

## Stack & hard constraints

- **Bun runs the backend**: server (`Bun.serve`), CLI, MCP runtime, `bun test`, and the standalone compiler. Server/core/MCP TypeScript executes directly — no build step there.
- **The client is a built Svelte SPA**: Svelte 5 runes + Vite + Tailwind v4 + shadcn-svelte. Source under `client/`, built to `dist/client`. No SvelteKit. `bun run dev` runs the backend + Vite together with `/api` proxied to that backend; `bun start` / `bun run preview` build and serve the client.
- **The shipped binary is self-contained**: `bun run build:binary` compiles a single executable that embeds `dist/client` (via a generated `with { type: "file" }` manifest) and the version — it runs anywhere with no checkout, `package.json`, or sidecar assets. Static serving goes through the `AssetSource` seam (`src/server/assetSource.ts`): a directory adapter in source/preview, the embedded map in the binary.
- **Distribution is the GitHub Releases channel**: `scripts/build-release.ts` cross-compiles all six OS/arch targets + `checksums.txt`; `install.sh`/`install.ps1` and `diffle update` download + SHA-256-verify from Releases; Release Please + `.github/workflows/release.yml` own versioning and the per-target binary/MCPB matrix.
- **Runtime dependencies stay narrow and pinned.** The MCP SDK and its schema dependency are the intentional runtime deps; the Svelte/Vite/Tailwind/test tooling is dev-only and exact-pinned. The docs site (`web/`) is a **separate package** so Astro/Starlight never touch the app's deps. Add a runtime package only when it replaces meaningful protocol or platform code.

## Engineering standards (enforced)

- **File size**: soft 150 lines, **hard 200** for server/core/MCP modules — split before you hit the cap. The Svelte client is not under a blanket line cap; Svelte components and client `.ts` modules split by responsibility (SRP). Exempt: the D5 token/theme CSS, and `src/types.ts` (the single-source contract — splitting it would break the one-import-surface invariant, which outranks the cap).
- **DRY** — extract anything used twice. Shared helpers in `src/utils/` (server) or `client/src/lib/` (client).
- **SRP** — one job per module. If describing a file needs "and", split it.
- **KISS / YAGNI** — build exactly what's asked. Keep agent adapters thin and avoid speculative extension points.
- **Types** — strict TS, no `any` on the contract types.
- **Readability** — named constants over magic values; plain-English function names (`compileReviewPrompt`, `resolveRef`, `resolveClientAssets`); comments lowercase, minimal, only when needed.

## The one architectural invariant

`src/types.ts` is the single source of truth for diff JSON, durable Review Records, the legacy `.review` shape, and API/MCP request bodies. **Nothing redefines these — import from `src/types.ts`.** The Svelte client imports them through the `$types` alias; it never re-declares a shape. Change shared shapes there first. Likewise, user-facing identity (name, command, env prefix, data dir, URLs) comes only from `src/core/product.ts` — never hardcode "diffle"/"loupe" strings.

## Layout

- `src/index.ts` — CLI entry: parse the ref/command → run + parse the diff → serve → open browser. Auto-runs only under `import.meta.main` (the compiled binary's generated entry injects assets + version, then calls `main`).
- `src/core/` — diff parsing, prompt compilation, durable Review Records, legacy `.review` import; `product.ts` (identity), `standalone.ts` (build-time asset/version injection), `dataDir.ts` (`~/.diffle` / `~/.loupe` resolver), `updateCheck.ts` + `update.ts` + `updateTarget.ts` (release channel + `diffle update`).
- `src/mcp/` — local stdio MCP server and its Review Record adapter.
- `src/server/` — `router` + `handlers` (`Bun.serve`). `GET /api/diff` re-runs git diff each call (live refresh). `assetSource.ts` serves the client; `fileHandlers.ts` guards paths.
- `src/utils/` — `git.ts` (`runGit`, `resolveRef`), `env.ts` (`productEnv`: DIFFLE_* then LOUPE_*), `installRoot.ts` (`isProductBinary`), `pathWithin.ts` (containment guards).
- `client/` — Svelte 5 SPA (Vite root). `client/src/lib/` typed API adapters + state stores + diff transforms, `client/src/lib/components/` the UI, `client/src/styles/` D5 tokens/theme. Built to `dist/client`.
- `scripts/` — `dev.ts` (`bun run dev` launcher), `generateStandaloneEntry.ts` + `build-binary.ts` (host binary), `build-release.ts` (cross-target + checksums), `stage-mcpb.ts` (per-target MCPB).
- `demos/` — **separate build-only package** (npm, React + Remotion, isolated like `web/`). Playwright drives the real backend with a visible cursor + paced typing to **record video takes** (`src/drivers.ts`, one per take) and to screenshot stills (`src/capture.ts`); Remotion composites the footage with screen-studio zooms, silent captions, and branded bookends into per-take shorts + a stitched reel (`docs/screenshots/walkthrough.{mp4,gif}`, `web/public/media/`). Never hand-author UI footage. See [`demos/README.md`](demos/README.md).
- `install.sh` / `install.ps1` — the `curl … | sh` installers (served from `diffle.dev/install`). `wrangler.jsonc` — Cloudflare static-assets deploy of `web/dist`.
- `web/` — Astro Starlight docs site (separate package) → `diffle.dev`. Themed with the D5 tokens; the build copies the root installers into `web/public/`.
- `vite.config.ts` / `vitest.config.ts` / `playwright.config.ts` — client build, unit/component tests, e2e.
- `tests/` — `bun test` (server/core/MCP), fixtures in `tests/fixtures/`. `e2e/` — Playwright specs (`*.pw.ts`).

## Commits — Conventional Commits

`<type>(<scope>): <short lowercase description>`. Allowed types and the 72-character header limit are enforced by `.commit-guard.json` and the `commitlint` check. Scopes: `parser` `server` `ui` `client` `store` `compiler` `build` `cli` `types` `tests`. Maintainers can install local `git commit-guard` hooks. One concern per commit; never batch unrelated changes.

## Testing & verification

- `bun test` covers server/core/MCP (scoped to `tests/` via `bunfig.toml`) — aim for full branch coverage on pure modules (`diffParser`, `promptCompiler`). Use fixtures for multi-line input; no fs mocking (temp dirs via `os.tmpdir()`).
- The client is tested with **Vitest + Testing Library** (`bun run client:test`) and **Playwright** e2e (`bun run test:e2e`, `.pw.ts`). Keep server `bun x tsc --noEmit` (strict) and client `bun run client:check` (svelte-check) both clean.
- MCP/plugin work also validates the MCPB manifest and both agent skills. Packaging work also verifies the compiled binary from a temp dir outside the checkout (version, review, `mcp serve`, `diffle update`) and `mcpb validate`.
- **Green tests ≠ a working app.** The frontend is not covered by `bun test`. Verify UI changes in a real browser (both themes, desktop + phone) before calling them done. (A `<>` fragment bug once left the entire diff pane blank while all tests passed.)
- **UI changes ship with regenerated media and docs.** If a change alters anything the screenshots or walkthrough footage show (comment box, review panel, file tree, diff views, dialogs), regenerate the demos in the same PR: `bun run client:build`, then from `demos/` (Node only, never Bun) `npm run build` (captures, records the takes, renders with Remotion, publishes to `docs/screenshots/` + `web/public/media/`) and `npm run shots` (copy the refreshed `public/shots/*.png` into `docs/screenshots/gallery/`). Then update the docs pages (`web/src/content/docs/**`, README) that describe the changed UI. Never hand-edit the published media.

## Releases

Release Please owns versioning: it analyzes Conventional Commits, opens the release PR, bumps `package.json`, updates `CHANGELOG.md`, tags `vX.Y.Z`, and drafts the GitHub Release. Merging the release PR is the release action; `.github/workflows/release.yml` then builds/uploads the per-target binaries + MCPBs and publishes. `.release-please-manifest.json` bootstraps the current version.
