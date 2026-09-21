# diffle — implementation plan (loupe → diffle evolution)

> Branch: `evolve`. Rewrite the frontend, rebrand, and modernize distribution + docs. Implementation is intended to run via Claude ultracode (workflow-orchestrated) per phase, staying in the loop between phases. Decisions behind this plan: [ADR 0004](../adr/0004-rename-loupe-to-diffle.md), [ADR 0005](../adr/0005-svelte-vite-drop-buildless.md), [ADR 0006](../adr/0006-distribution-binaries-install-script.md); brand: [design.md](design.md).

**Goal:** Replace the buildless Preact client with a Svelte 5 + Vite + Tailwind + shadcn-svelte SPA in the new dark-first diffle brand, keep the Bun server/CLI/MCP core and `src/types.ts` contract intact, ship zero-friction cross-platform binaries, move docs to Astro Starlight, and add Remotion product demos — without a functional regression in the review workflow.

**Architecture:** Client fully rewritten (Svelte 5 runes SPA, Vite build → static assets). Server largely unchanged: `Bun.serve` router + handlers, git/diff/review-record core, stdio MCP mode; `clientDir` repoints from `src/client` to the Vite build output. Client state is domain rune stores (`diff`, `comments`, `review`, `prefs`, `ui`) imported directly by components — no prop-drilling. Distribution via install script + GitHub Releases binaries + per-OS MCPB.

**Tech stack:** Bun (server/CLI/MCP runtime + `--compile`), Svelte 5, Vite, Tailwind v4, shadcn-svelte (Bits UI), `svelte/motion` + GSAP + NumberFlow + View Transitions, Astro Starlight (docs), Remotion (demos). Testing: `bun test` (core/server), Vitest + `@testing-library/svelte` (components), Playwright (E2E smoke).

## Global constraints

- `src/types.ts` stays the single source of truth for diff JSON, Review Records, `.review`, and API/MCP bodies — import, never redefine.
- Server API routes and behavior are preserved so the rewrite is client-only where possible; `GET /api/diff` still re-runs git each call.
- All new identity strings (name, binary, MCPB, marketplace, domain) route through one config module so the loupe→diffle swap (Phase 6) is one change; keep `diffle` as the working name, contingent on the [ADR 0004](../adr/0004-rename-loupe-to-diffle.md) confirmations.
- New brand per [design.md](design.md); Tailwind theme tokens are generated from the D5 palette (one source of truth for color).
- Keep `bun test` + `bun x tsc --noEmit` green; add Vitest/Playwright green as those land.
- Verify UI in a real browser before calling a component done (buildless-era lesson: green tests ≠ working app).

## Phases

### Phase 0 — Tooling & scaffold
- [ ] Add Vite + Svelte 5 + Tailwind v4 + shadcn-svelte; establish `client/` (Svelte source) → build output (e.g. `dist/client`).
- [ ] Repoint `clientDir` (reviewLaunch/handlers) to the Vite build output; `serveStatic` serves built assets; dev flow (Vite dev server proxied, or build-then-serve) documented.
- [ ] Generate Tailwind theme tokens from the D5 palette; wire dark-default + light-variant scaffolding.

### Phase 1 — Contract & stores
- [ ] Keep `src/types.ts`; add the client API layer (typed fetch of the existing endpoints).
- [ ] Build domain rune stores: `diff`, `comments`, `review`, `prefs` (persisted), `ui`. Port the behavior currently in `app.js` + hooks.

### Phase 2 — Component migration (Svelte + shadcn, D5)
- [ ] App shell + top bar; file tree (folder/row); diff view (lines, word-diff, split/unified); comments (editor, replies, threads, resolve, addressed); modals (compile, help, what's-new); overlays (help, popovers).
- [ ] Rebuild each on shadcn-svelte primitives restyled to the diffle palette; parity with current features.

### Phase 3 — Motion
- [ ] Springs/transitions for diff-line reveal, comment-anchor pulse, FLIP list reordering, resolve/collapse, optimistic-save; NumberFlow counts; View Transitions for theme/file→diff; reduced-motion gated in code.

### Phase 4 — Packaging
- [ ] `stage-mcpb` copies the built client (not `src/client`); `bun build --compile` ships the built client alongside the binary; verify per-OS resolution via `installRoot`.

### Phase 5 — Distribution
- [ ] Install script (`diffle.sh/install[.ps1]`) hosted on Cloudflare; GitHub Actions tag-triggered matrix builds 3 binaries + 3 MCPBs + checksums + Release; Homebrew/Scoop/winget manifests; `diffle update` (install-aware self-update).
- [ ] Update Claude Code + Codex plugin docs to the install-script flow (drop the hidden clone requirement).

### Phase 6 — Rebrand swap
- [ ] Flip identity strings loupe→diffle via the one config module: `package.json`, binary, MCPB `name`/`display_name`, marketplace manifests, homepage/repo URLs; GitHub repo rename + redirect. (Gate on ADR 0004 confirmations.)

### Phase 7 — Docs replatform
- [ ] Astro Starlight site (Getting started / Guides / Reference) in the diffle brand, hosted on Cloudflare Pages; retire `site/` + `.github/workflows/pages.yml`.

### Phase 8 — Demos
- [ ] `demos/` Remotion project (isolated React, build-only) compositing real Playwright-captured footage into polished product demos; outputs consumed by the docs site + README.

### Phase 9 — Cleanup (runs on this branch alongside the above)
- [ ] Remove the retired buildless client (`src/client/*.js`, `preact.js`, the CDN `index.html`) and its CSS once Svelte parity lands.
- [ ] Remove dead code, the old `site/` marketing pages, `pages.yml`, and any proof-desk brand assets.
- [ ] Rewrite root `AGENTS.md`/`CLAUDE.md` (drop the buildless hard constraint, the 200-line client-module cap rationale, htm gotchas) and replace root `DESIGN.md` from [design.md](design.md).
- [ ] Update `README.md`, `CHANGELOG.md`, and the release checklist for the new stack + distribution.

## Verification threaded through

Each component/phase verified in a real browser (Vite preview) before "done"; `bun test`/typecheck/Vitest kept green; a Playwright smoke covers the launch→review→return-feedback path before release.
