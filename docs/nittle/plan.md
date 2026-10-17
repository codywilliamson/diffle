# diffle — implementation plan (loupe → diffle evolution)

> Branch: `evolve`. Rewrite the frontend, rebrand, and modernize distribution and docs. Implementation runs through bounded Claude UltraCode workflows, one phase at a time. Decisions: [ADR 0004](../adr/0004-rename-loupe-to-diffle.md), [ADR 0005](../adr/0005-svelte-vite-drop-buildless.md), [ADR 0006](../adr/0006-distribution-binaries-install-script.md). Visual system: [design.md](design.md). Behavioral acceptance: [parity.md](parity.md).

**Goal:** Replace the buildless Preact client with a Svelte 5 + Vite + Tailwind + shadcn-svelte SPA in the dark-first diffle brand, keep the Bun server/CLI/MCP core and `src/types.ts` contract, ship self-contained cross-platform executables, move docs to Astro Starlight, and add Remotion product demos without regressing the review workflow.

**Architecture:** Svelte source lives in `client/`; Vite emits `dist/client`. The server keeps its `Bun.serve` router, Git/diff/review-record core, and stdio MCP mode. A typed app-state factory creates the `diff`, `comments`, `review`, `prefs`, and `ui` rune modules and exposes them through typed Svelte context helpers. That avoids prop drilling without process-global singleton state leaking between tests. Browser API routes stay compatible. A small client-asset-source seam has a directory adapter for development and a generated embedded-manifest adapter for the executable. Production builds embed `dist/client` and the version; the installed app does not depend on a checkout, `package.json`, or sidecar web assets.

## Invariants and gates

- `src/types.ts` remains the single source for diff JSON, Review Records, legacy `.review`, and API/MCP bodies. Client code imports these types; it does not shadow them.
- The durable Review Record remains authoritative. Local mutations adopt the returned record, poll responses older than the current `updatedAt` are ignored, and a `reviewId` change invalidates in-flight requests.
- The Svelte client becomes the default in Phase 0. The branch does not preserve a runnable Preact fallback or dual-client switch. `src/client` remains only as read-only parity evidence until Phase 3 removes it.
- Work test-first in vertical slices. The agreed seams are core/server interfaces (`bun test`), pure client and typed HTTP behavior (Vitest), Svelte user interactions (Testing Library), and real launch/review workflows (Playwright). Write one failing behavior test, add only enough implementation to pass, then continue; review and refactor after the slice is green.
- D5 semantic CSS variables in [design.md](design.md) are the color source of truth. Tailwind and shadcn-svelte alias those variables instead of creating another palette.
- Machine-consumed identity comes from one product config used by runtime and manifest-generation scripts. Human docs are updated deliberately; they are not generated from code.
- Local phases do not register domains, create organizations, rename the GitHub repository, deploy, tag, or release. Those externally visible actions require a separate go-ahead at the relevant gate.
- Preserve unrelated work. Keep each phase reviewable and use Conventional Commits with one concern per commit.

## Phase 0 — Baseline and Svelte scaffold

- Capture a clean baseline: `git status`, `bun test`, `bun x tsc --noEmit`, current binary/MCPB validation, and browser screenshots at desktop and phone widths.
- Inventory browser routes and current behavior against [parity.md](parity.md). Record a missing behavior before coding instead of silently dropping it.
- Add Svelte 5, Vite, Tailwind v4, shadcn-svelte, Vitest, Testing Library, and Playwright configuration. Keep runtime dependencies pinned and justify each new production dependency.
- Drive the typed `/api/diff` adapter with Vitest, the loading/success/error shell with Testing Library, and the real production-preview launch with a failing Playwright tracer bullet before implementing each slice.
- Create `client/` → `dist/client`, D5 light/dark tokens, base typography, themed browser surfaces, and the minimal shell required by those tests.
- Make the Playwright tracer bullet drive one documented `bun run dev` path that starts a review backend and Vite together, proxies `/api` to that exact backend, preserves the `?review=` query, and opens the Vite URL. Add a production-preview command that serves the built client through Bun.
- Repoint `bun start` and production preview to `dist/client`. The Vite dev launcher proxies to the same Bun API server; do not add a fallback, feature flag, public CLI option, or dual-client routing.
- Replace root `DESIGN.md` with a pointer to [design.md](design.md). Update `AGENTS.md` after the scaffold exists: remove buildless/htm rules and the blanket client line cap, retain the server/core constraints that still apply. `CLAUDE.md` already includes `AGENTS.md` and needs no duplicate edit.

**Exit:** `bun start`, the dev launcher, and production preview all use the Svelte shell; Bun tests, typecheck, Vitest, and one Playwright shell smoke are green. The branch makes no claim that the old client still runs.

## Phase 1 — Typed client modules and state ownership

- Build typed fetch adapters for every existing browser endpoint. Non-2xx responses preserve the server's error text and expose abort signals where stale work matters.
- Create app-state factories for `diff`, `comments`, `review`, `prefs`, and `ui`, then compose them once at the app root through typed context helpers.
- Keep responsibilities explicit: `review` owns the current Review Record, polling generation, activity notice, and outcome transitions; `comments` derives from that record and owns reviewer mutation commands; `diff` owns load/refresh; `prefs` owns persisted presentation choices and key migration; `ui` owns ephemeral overlays, selection, and responsive state.
- Move pure transforms such as tree building, anchors, stale-comment partitioning, word ranges, and feedback formatting into ordinary TypeScript modules tested without Svelte.

**Exit:** store tests cover initial load, failed load, overlapping poll/save responses, `reviewId` changes, legacy mode, and every valid/invalid Review Outcome transition.

## Phase 2 — Vertical-slice client migration

Migrate complete user slices instead of recreating the old file graph component by component:

1. App shell, review context, file index, filtering, viewed state, and responsive drawer.
2. Unified diff, syntax/word highlighting, file collapse, large-file behavior, and inline/file/range comments.
3. Side-by-side diff, pane resizing/scrolling, wrap and single-file modes, markdown preview, binary and stale-comment states.
4. Review panel, summaries, replies, addressed/resolved state, polling notices, refresh, legacy import, feedback preview/copy, help, update, and What's New.

Use shadcn-svelte only where a primitive earns its dependency. Restyle primitives with D5 tokens and preserve keyboard/focus behavior. Verify each slice in a real browser in both themes and at desktop and phone widths.

For each numbered slice, start with one failing Playwright behavior at the public browser seam, then use Vitest or Testing Library for the narrower behaviors needed to make that tracer pass. Do not write the whole phase's tests up front or assert private rune-store/component implementation details.

**Exit:** every item in [parity.md](parity.md) is implemented or recorded as an intentional product change; component tests and the full Playwright review smoke are green.

## Phase 3 — Motion, accessibility, and parity cleanup

- Add state-driven Svelte motion, transitions, FLIP reordering, NumberFlow counts, and feature-detected View Transitions only after the relevant behavior is stable. Use GSAP only for a sequence that Svelte cannot express cleanly.
- Gate Svelte/WAAPI/GSAP motion in code for `prefers-reduced-motion`; CSS overrides alone are not sufficient. Clear timers and animation callbacks on close, route/review change, and unmount.
- Run keyboard, screen-reader-name, focus-return, contrast, reduced-motion, and responsive checks. Confirm only the active overlay handles Escape.
- Remove the retired Preact/htm/CDN client and buildless-only docs after the parity and accessibility gates pass. No runtime switch is needed because Svelte has been the branch default since Phase 0.

**Exit:** `bun start` serves the Svelte client, the old client is gone, all automated checks pass, and a human browser pass signs off the acceptance checklist.

## Phase 4 — Self-contained packaging

- Replace the ad hoc binary command with a build script that runs Vite, enumerates `dist/client`, generates a deterministic manifest with one static `with { type: "file" }` import per asset, compiles that manifest into the executable, and injects the package version as a build-time constant. Do not rely on `compile.assets`/`--asset`: the repository's current Bun 1.3.14 does not expose that newer interface.
- Put static serving behind one small asset-source interface: source/preview mode uses a contained `dist/client` directory adapter; standalone mode uses the generated URL-to-embedded-file map. Preserve MIME types, `index.html` handling, containment, and 404 behavior across both adapters.
- Stage MCPBs from the same self-contained executable. Do not copy a second client tree into the MCPB.
- Test the executable and MCPB from a temporary directory outside the checkout with the source tree unavailable.

**Exit:** CLI review, `mcp serve`, version output, update status, and browser assets work from only the built executable; MCPB validation and clean-install smoke pass.

## Phase 5 — Rebrand with compatibility

- Change user-facing identity, executable/package names, manifests, plugin metadata, docs URLs, and UI strings through the product config and generators.
- Install `diffle` as the primary command and keep a deprecated `loupe` command alias for one minor release so existing plugins and scripts do not fail abruptly.
- Prefer `DIFFLE_*` environment variables while honoring legacy `LOUPE_*` names for one compatibility window.
- Use `~/.diffle` for new users. If an existing user has `~/.loupe` and no `~/.diffle`, continue using the legacy directory without copying or deleting it; make all state, session, and review-record code use the same resolver. Migrate `loupe-*` browser preferences to `diffle-*` keys on first read.
- Do not rename the repository or publish the identity until the domain/trademark/org gate is complete.

**Exit:** new and upgrade-path tests pass, old Review Records remain discoverable, both command names work during the compatibility release, and no destructive migration occurs.

## Phase 6 — Release and installer channel

- Configure `googleapis/release-please-action` in manifest mode with the Node release strategy, `draft: true`, and forced tag creation. It owns Conventional Commit analysis, the release PR, `package.json`/manifest version updates, `CHANGELOG.md`, the `vX.Y.Z` tag, and draft GitHub Release creation. Merging the release PR is the explicit release action.
- In the same workflow, gate an explicit `windows-x64`, `windows-arm64`, `linux-x64`, `linux-arm64`, `darwin-x64`, and `darwin-arm64` matrix on Release Please's `release_created` output. Upload one executable and MCPB per target plus a signed or release-attested checksum manifest into the draft, then publish only after every required job succeeds. Do not depend on a separate tag/release-triggered workflow fired by the built-in `GITHUB_TOKEN`.
- Host `install` and `install.ps1` on the approved Cloudflare domain. Detect OS/architecture, download the exact release asset and checksum manifest, verify SHA-256 before replacement, and install into a user-writable directory with clear PATH guidance.
- Make `diffle update` use the same verified installer path. Use an after-exit helper on Windows; refuse self-update for package-manager installs and print the exact manager command instead.
- Replace the clone/origin-based update check with the release channel and an embedded current version. Treat network failure as non-fatal.
- Update Claude Code and Codex plugin docs to the installed binary. Keep Claude Desktop MCPBs self-contained.
- Add Homebrew, Scoop, and winget only after the primary installer/release path is proven; they are a fast-follow, not a blocker for the first public binary release.

**Exit:** clean machines for each supported OS family can install, run a browser review, run MCP, update, and uninstall without a repository clone or Bun installation.

## Phase 7 — Documentation site

- Build an Astro Starlight site with separate Getting Started tutorials, task-focused Guides, and exhaustive Reference pages. Use D5 tokens and deploy to Cloudflare Pages only after the domain is approved.
- Replace clone-first install instructions, document compatibility/migration behavior, and retire `site/` plus `.github/workflows/pages.yml` only after the new site is live.

## Phase 8 — Product demos

- Keep the Remotion project isolated under `demos/`; React is a build-only demo dependency, not part of the app.
- Drive a deterministic temporary repository through Playwright, capture real product states, and composite those captures. Do not hand-create UI footage that can drift from the product.
- Consume outputs from the docs site and README without committing unnecessary intermediate media.

## Phase 9 — Release-readiness gate

- Remove transitional flags, unused dependencies, dead assets, and stale proof-desk copy that were intentionally retained during migration.
- Update `README.md`, `CHANGELOG.md`, contributor setup, release checklist, `AGENTS.md`, and plugin/MCPB validation instructions.
- Run the entire test/type/build/package/browser matrix from a clean checkout. Review the diff for secrets, generated junk, old identity leaks, and files over the repository's current limits.
- Stop before domain registration, org/repo rename, deployment, tag, or GitHub release unless those actions were explicitly approved.
