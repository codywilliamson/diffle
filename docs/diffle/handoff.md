# diffle — implementation handoff (Phases 0–3 done → Phase 4)

> Branch: `evolve`. The frontend rewrite is **functionally complete**: the Svelte client is at full loupe parity and the retired Preact client is gone. Phases 0–3 are committed and verified. What remains (Phases 4–9) is packaging, the user-facing rebrand, release, docs, and demos — mostly gated on external go-aheads. This doc lets a fresh session pick up **Phase 4** without re-deriving the state.

## Status — what's done

| Phase | Outcome |
|---|---|
| 0 | Svelte 5 + Vite + Tailwind v4 + shadcn scaffold; D5 tokens; dev/preview wiring; baseline captured |
| 1 | Typed adapters for every endpoint; pure transforms; five rune stores composed via typed context |
| 2 | Full UI: shell, file index, unified + side-by-side diff, syntax + word highlighting, inline/range/file comments, large-file gate, wrap/single-file, sanitized markdown preview, stale comments, review panel + outcomes + feedback copy, sync notice + polling, help, What's New, update badge, legacy prompt, shortcuts |
| 3 | Reduced-motion-gated transitions, focus-trapping modal + Escape handling, svelte-check a11y clean, **removed `src/client`** |

The three parity contradictions from the Phase 0 audit are all **implemented** (not just decided): sanitized markdown preview (ADR 0007), focus-trapping dialogs, and empty/no-diff states.

**Gate (all green):** `bun test` 204 · server `tsc` 0 · Vitest 83 · svelte-check 0 · Playwright 7 · client build · binary compile · MCPB validate. Browser-verified at desktop + phone, light + dark.

## Layout as it is now

- `src/` — Bun server/CLI/core/MCP, **unchanged in spirit**. `src/types.ts` is still the only shared contract. `src/core/reviewLaunch.ts` serves `clientDir = dist/client`.
- `client/` — Svelte 5 SPA (Vite root → `dist/client`):
  - `client/src/lib/api/` — `http.ts` (typed GET/POST + error text + abort) and `diff`/`comments`/`review`/`meta` adapters.
  - `client/src/lib/state/` — rune stores `ui`/`prefs`/`diff`/`review`/`comments` (`.svelte.ts`), `reviewRecord.ts` helpers, `context.ts` (composes all five, reads `?review=`, typed `getAppState`/`setAppState`).
  - `client/src/lib/diff/` — pure transforms: `tree`, `wordDiff`, `highlight`, `metrics`, `threads`, `selectDrag`, `markdown`. `client/src/lib/anchor.ts` **re-exports `src/core/anchor.ts`** (shared, do not duplicate).
  - `client/src/lib/components/` — `TopBar`, `FileIndex`, `Modal`, overlays; `diff/*` (DiffView/FileSection/UnifiedDiff/SplitDiff/MarkdownPreview), `comment/*`, `review/*`, `tree/*`.
  - `client/src/styles/` — `tokens.css` (D5, both themes), `base.css`, `diff.css` (diff table + syntax theme + comment layer + markdown prose).
- `e2e/` — Playwright (`*.pw.ts`) via `e2e/harness.ts` (`makeFixture`/`startPreview`/`stop`/`cleanup`/`gotoApp`).
- Commands: `bun start` · `bun run dev` (backend + Vite, `/api` proxied) · `bun run preview` · `client:build` · `client:test` (Vitest) · `client:check` (svelte-check) · `test:e2e` · `build:binary` · `mcpb:validate`.

## Gotchas — read before touching anything

- **Test runners are split.** `bun test` is scoped to `tests/` via `bunfig.toml` (it cannot run `.svelte` or Testing Library). The client is Vitest-only. `svelte-check` must run with cwd = `client/` (that's what `client:check` does). The root server `tsconfig` excludes `client`, `e2e`, `dist`, `mcpb`, `out`.
- **Playwright runs via `npx playwright test`, not Bun** (Bun + Playwright hangs on Windows). Tracers use `gotoApp` to dismiss the auto-shown What's-New modal so it doesn't block clicks.
- **New dev deps (all dev, exact-pinned):** `@lucide/svelte`, `highlight.js`, `marked`, `dompurify` (client bundle); plus the Phase 0 toolchain. Runtime deps stay the MCP SDK + zod only.
- **Intentional simplifications** vs old loupe: side-by-side is a single table (shift+wheel gives shared horizontal scroll; fully-independent per-pane horizontal scroll is not implemented). Motion shipped the foundational transitions + FLIP only — **NumberFlow, GSAP, and View Transitions are deferred**. What's-New uses a placeholder version constant `0.16.0` in `client/src/lib/whatsNew.ts` (real versioning is Phase 6). User-level What's-New "seen" state persists to `~/.loupe/state.json` via `homedir()` — **not** `LOUPE_DATA_DIR` (which only moves review records).
- Git shows `LF will be replaced by CRLF` on commits — normal on Windows, ignore.

## Phase 4 — the next phase (self-contained packaging)

This is a **local** phase (no external gate). Paste the block below into a fresh Claude UltraCode session at the repo root. Do not start Phase 5.

```
diffle Phase 4 — self-contained packaging

You are continuing the diffle build on branch `evolve`. Phases 0–3 are complete (see
docs/diffle/handoff.md and docs/diffle/plan.md). Use Workflow orchestration only for
genuinely independent work; do the stateful build + verification directly. Do not start
a plan and stop — execute, verify, commit each concern with Conventional Commits, then
report.

Read first: docs/diffle/plan.md (Phase 4), docs/adr/0006-distribution-binaries-install-script.md,
docs/diffle/handoff.md, src/core/reviewLaunch.ts, src/server/fileHandlers.ts (serveStatic),
src/index.ts, scripts/stage-mcpb.ts, package.json.

Locked constraints:
- Bun stays the compiler. The repo's Bun is 1.3.14, which does NOT expose the newer
  `compile.assets`/`--asset` CLI. Build embedding with static `with { type: "file" }`
  imports generated from the Vite output — do not build around `compile.assets`, sidecar
  assets, or an installed checkout.
- The executable must run from anywhere with no `package.json`, no `dist/client` sidecar,
  and no repo. Inject the package version as a build-time constant.
- `src/types.ts` remains the only shared contract.

Do Phase 4 from docs/diffle/plan.md:
1. Replace the ad-hoc `build:binary` with a build script that runs Vite, enumerates
   `dist/client`, generates a deterministic manifest with one static `with { type: "file" }`
   import per asset, compiles that manifest into the executable, and injects the version.
2. Put static serving behind one small asset-source interface: a directory adapter for
   source/preview mode (current `serveStatic` over `dist/client`) and a generated
   URL-to-embedded-file adapter for the standalone binary. Preserve MIME types,
   `index.html` handling at `/`, path containment, and 404 behavior across both.
3. Stage MCPBs from that same self-contained executable — do not copy a second client tree.
4. Test the executable and MCPB from a temp dir OUTSIDE the checkout with the source tree
   unavailable: CLI review, `mcp serve`, version output, update status, and browser assets
   must all work from only the built binary.

Verify: bun test, bun x tsc --noEmit, client:test, client:check, test:e2e, client build,
the new standalone binary run from a temp dir, and MCPB validation — all green. Do not
register a domain, rename the repo, deploy, tag, release, or change product identity.
Report commits, exact verification commands + results, and the handoff for Phase 5.
```

## Phases 5–9 (after Phase 4)

All detailed in [`plan.md`](plan.md); each externally-visible action is separately gated:

- **5 — Rebrand with compatibility:** flip user-facing identity loupe→diffle through one product config; keep a deprecated `loupe` command + `LOUPE_*` env for one minor release; `~/.diffle` for new users, keep `~/.loupe` when present; migrate `loupe-*` browser pref keys → `diffle-*` (the prefs store already namespaces `diffle-*` and reads `loupe-*` as fallback — wire the real migration + product config here). Update `client/src/lib/whatsNew.ts` to the real version.
- **6 — Release + installer:** Release Please (manifest mode, draft, forced tags) + a gated per-OS binary/MCPB matrix; `install`/`install.ps1` on the approved Cloudflare domain with SHA-256 verification; `diffle update` on the same path.
- **7 — Docs site:** Astro Starlight with D5 tokens; retire `site/` + the Pages workflow.
- **8 — Demos:** Remotion under `demos/` driven by Playwright captures.
- **9 — Release-readiness:** remove transitional flags/dead assets, refresh all docs, run the full matrix from a clean checkout.

Nothing in 5–9 has started. Stop before any domain registration, repo rename, deploy, tag, or release unless explicitly approved.
