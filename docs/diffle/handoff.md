# diffle — implementation handoff (Phases 0–4 done → Phase 5)

> Branch: `evolve`. The frontend rewrite is **functionally complete and refined through a dogfooding review pass** (diffle reviewing diffle), and the binary is now **self-contained** — the compiled executable embeds the built client and its version, so it runs anywhere with no checkout, `package.json`, or `dist/client` sidecar. Phases 0–4 are committed and verified. What remains (Phases 5–9) is the user-facing rebrand, release, docs, and demos — mostly gated on external go-aheads. This doc lets a fresh session pick up **Phase 5** without re-deriving the state.

## Status — what's done

| Phase | Outcome |
|---|---|
| 0 | Svelte 5 + Vite + Tailwind v4 + shadcn scaffold; D5 tokens; dev/preview wiring; baseline captured |
| 1 | Typed adapters for every endpoint; pure transforms; five rune stores composed via typed context |
| 2 | Full UI: shell, file index, unified + side-by-side diff, syntax + word highlighting, inline/range/file comments, large-file gate, wrap/single-file, sanitized markdown preview, stale comments, review panel + outcomes + feedback copy, sync notice + polling, help, What's New, update badge, legacy prompt, shortcuts |
| 3 | Reduced-motion-gated transitions, focus-trapping modal + Escape handling, svelte-check a11y clean, **removed `src/client`** |
| 4 | Self-contained binary: static serving behind an `AssetSource` seam (directory adapter for source/preview, embedded-import map for the binary); `scripts/build-binary.ts` vite-builds, embeds `dist/client` via generated `with { type: "file" }` imports, injects the version; MCPB staged from that one binary (no second client tree) |

The three parity contradictions from the Phase 0 audit are all **implemented** (not just decided): sanitized markdown preview (ADR 0007), focus-trapping dialogs, and empty/no-diff states.

**Post-review polish (dogfooding pass, all committed):** rebuilt the **feedback preview modal** (`review/FeedbackPreview.svelte`, rendered/raw + copy, opened from the review popover); **restored the sidebar resize handle** (`Resizer.svelte`); fixed the **sticky file header** (`overflow-hidden` was breaking `position: sticky`); **collapse deleted files by default** (GitHub-style); **side-by-side panes locked 50/50** with per-cell horizontal scroll (`table-layout: fixed` + colgroup — a long line no longer shoves the new pane off-screen); pinned + width-capped the **inline comment box** on wide diffs; readable comment **tag badges**; **refresh icon spins** while re-running; a **theme crossfade** (View Transitions API); folder **collapse animation**; and a general **motion pass** (cubic-out easing, popover/diff reveals). `DESIGN.md` now holds the full D5 system; `docs/diffle/design.md` points to it.

**Gate (all green):** `bun test` 204 · server `tsc` 0 · Vitest 83 · svelte-check 0 · Playwright 7 · client build · binary compile · MCPB validate. Browser-verified at desktop + phone, light + dark, including the review/comment/feedback flows. **Phase 4 also verified the compiled `dist/loupe.exe` from a temp dir with the source tree unavailable:** `--version`, CLI review (embedded `index.html`/JS/CSS served with correct MIME + a 404 for missing/traversal paths), `/api/diff`, `/api/update` (no crash on the non-repo install root), and `mcp serve` all work from only the binary.

### Open `evolve` enhancement backlog (GitHub issues, labeled `enhancement` + `evolve`)

Out-of-scope items found while dogfooding — deferred, not lost:
- **#23** — proper Svelte syntax highlighting (`.svelte` currently maps to `xml`; highlight.js has no Svelte grammar).
- **#24** — independent per-pane horizontal scroll + a draggable split divider (the 50/50 fix above is the interim; true per-pane scroll/resize needs a non-table rebuild).
- **#25** — fuller motion: NumberFlow counts, staggered diff-line reveals, GSAP, file→diff View Transition morph.
- **#26** — scope the review to a folder by clicking it in the file tree.

## Layout as it is now

- `src/` — Bun server/CLI/core/MCP, **unchanged in spirit**. `src/types.ts` is still the only shared contract. Static client serving now goes through `src/server/assetSource.ts` (`AssetSource`: `directoryAssets(clientDir)` for source/preview, `embeddedAssets(map)` for the binary); `src/core/standalone.ts` is the build-injection seam (`resolveClientAssets` + `injectedVersion`, both default to source-mode behavior); `src/utils/pathWithin.ts` holds the shared containment guards. `scripts/build-binary.ts` compiles `src/generated/standalone.ts` (generated, gitignored, excluded from `tsconfig`) into `dist/loupe`.
- `client/` — Svelte 5 SPA (Vite root → `dist/client`):
  - `client/src/lib/api/` — `http.ts` (typed GET/POST + error text + abort) and `diff`/`comments`/`review`/`meta` adapters.
  - `client/src/lib/state/` — rune stores `ui`/`prefs`/`diff`/`review`/`comments` (`.svelte.ts`), `reviewRecord.ts` helpers, `context.ts` (composes all five, reads `?review=`, typed `getAppState`/`setAppState`).
  - `client/src/lib/diff/` — pure transforms: `tree`, `wordDiff`, `highlight`, `metrics`, `threads`, `selectDrag`, `markdown`. `client/src/lib/anchor.ts` **re-exports `src/core/anchor.ts`** (shared, do not duplicate).
  - `client/src/lib/` (root helpers) — `format.ts`, `motion.ts` (reduced-motion-gated fade/fly/scale/slide/FLIP), `viewTransition.ts` (theme crossfade), `actions.ts` (`nearViewport`, `clickOutside`), `shortcuts.ts`, `whatsNew.ts`.
  - `client/src/lib/components/` — `TopBar`, `FileIndex`, `Resizer`, `Modal`, `HelpOverlay`, `WhatsNewModal`, `UpdateBadge`, `LegacyPrompt`, `StaleComments`; `diff/*` (DiffView/FileSection/UnifiedDiff/SplitDiff/MarkdownPreview), `comment/*` (editor/card/thread/replies/composer), `review/*` (ReviewPanel/SyncNotice/FeedbackPreview), `tree/*`.
  - `client/src/styles/` — `tokens.css` (D5, both themes), `base.css` (typography + surfaces + reduced-motion guard + view-transition), `diff.css` (diff table + syntax theme + comment layer + markdown prose).
- `e2e/` — Playwright (`*.pw.ts`) via `e2e/harness.ts` (`makeFixture`/`startPreview`/`stop`/`cleanup`/`gotoApp`).
- Commands: `bun start` · `bun run dev` (backend + Vite, `/api` proxied) · `bun run preview` · `client:build` · `client:test` (Vitest) · `client:check` (svelte-check) · `test:e2e` · `build:binary` · `mcpb:validate`.

## Gotchas — read before touching anything

- **Test runners are split.** `bun test` is scoped to `tests/` via `bunfig.toml` (it cannot run `.svelte` or Testing Library). The client is Vitest-only. `svelte-check` must run with cwd = `client/` (that's what `client:check` does). The root server `tsconfig` excludes `client`, `e2e`, `dist`, `mcpb`, `out`, `src/generated`.
- **The binary embeds the client, so rebuild it after client changes.** `bun run build:binary` runs vite first, then regenerates `src/generated/standalone.ts` (one `with { type: "file" }` import per `dist/client` asset, sorted/deterministic) and compiles it. The generated entry statically imports `main` from `src/index.ts`, so `index.ts` only auto-runs under `import.meta.main`. Some Windows ports sit in an excluded range and `Bun.serve` refuses them — verify the binary with the default (any-free) port and parse the URL from the banner, not a hardcoded port.
- **Playwright runs via `npx playwright test`, not Bun** (Bun + Playwright hangs on Windows). Tracers use `gotoApp` to dismiss the auto-shown What's-New modal so it doesn't block clicks.
- **New dev deps (all dev, exact-pinned):** `@lucide/svelte`, `highlight.js`, `marked`, `dompurify` (client bundle); plus the Phase 0 toolchain. Runtime deps stay the MCP SDK + zod only.
- **Intentional simplifications** vs old loupe (all tracked as `evolve` issues, see backlog above): side-by-side is a single `table-layout: fixed` table — panes stay 50/50 and long lines scroll per-cell, but true per-pane scroll + a draggable split divider are not implemented (**#24**). Motion shipped the foundational transitions + FLIP + theme crossfade; NumberFlow/GSAP/staggered reveals are deferred (**#25**). `.svelte` files highlight as `xml` (**#23**). What's-New uses a placeholder version constant `0.16.0` in `client/src/lib/whatsNew.ts` (real versioning is Phase 6). User-level What's-New "seen" state persists to `~/.loupe/state.json` via `homedir()` — **not** `LOUPE_DATA_DIR` (which only moves review records).
- Git shows `LF will be replaced by CRLF` on commits — normal on Windows, ignore.

## Phase 4 — done (self-contained packaging)

Committed on `evolve`: `98468ac` (asset-source seam), `c123327` (build-binary + version inject), `326838d` (MCPB from the one binary). What landed, so Phase 5 doesn't relitigate it:

- **`AssetSource` seam** (`src/server/assetSource.ts`): `serveStatic(assets, pathname)` takes the source instead of reading `ctx.clientDir`. `ServerContext.clientDir` → `ServerContext.assets`. Path-containment guards extracted to `src/utils/pathWithin.ts`.
- **Build injection** (`src/core/standalone.ts`): `useStandaloneBuild({version, assets})` is called once by the generated entry; `resolveClientAssets`/`injectedVersion` default to the directory adapter + `package.json` in every other mode. `currentVersion` now tolerates a missing `package.json`.
- **`scripts/build-binary.ts`**: vite build → walk `dist/client` (sorted) → generate `src/generated/standalone.ts` (one `with { type: "file" }` import per asset + version literal, then `await main()`) → `bun build --compile`. `src/index.ts` auto-runs only under `import.meta.main`.
- **`scripts/stage-mcpb.ts`**: copies only the binary; sweeps legacy `mcpb/{src,dist,package.json}` so `mcpb pack` can't bundle a stale client tree.

**Phase 5 is the next phase.** It is the first phase with an external gate (identity). Paste the block below into a fresh session at the repo root; do not start Phase 6.

```
diffle Phase 5 — rebrand with compatibility

You are continuing the diffle build on branch `evolve`. Phases 0–4 are complete (see
docs/diffle/handoff.md and docs/diffle/plan.md). Use Workflow orchestration only for
genuinely independent work; do the stateful edits + verification directly. Do not start
a plan and stop — execute, verify, commit each concern with Conventional Commits, then
report.

Read first: docs/diffle/plan.md (Phase 5), docs/adr/0004-rename-loupe-to-diffle.md,
docs/diffle/handoff.md, src/index.ts, src/utils/cli.ts, src/utils/installRoot.ts,
src/core/updateCheck.ts, scripts/stage-mcpb.ts, client/src/lib/state/prefs (the
diffle-*/loupe-* key handling), client/src/lib/whatsNew.ts.

Locked constraints:
- Flip user-facing identity loupe→diffle through ONE product config used by both the
  runtime and the manifest/build scripts. Human docs are updated deliberately, not generated.
- Keep a deprecated `loupe` command alias and honor `LOUPE_*` env for one minor release
  alongside the new `DIFFLE_*`. Prefer `~/.diffle`; if `~/.loupe` exists and `~/.diffle`
  does not, keep using the legacy dir without copying or deleting it — one resolver for all
  state/session/review-record code. Migrate `loupe-*` browser pref keys → `diffle-*` on first read.
- `src/types.ts` remains the only shared contract. Do NOT rename the repo or publish the
  identity — the domain/trademark/org gate is not yet cleared.

Do Phase 5 from docs/diffle/plan.md (product config + generators, command alias, env + data-dir
resolver, prefs key migration, UI strings, whatsNew real version). Verify: bun test,
bun x tsc --noEmit, client:test, client:check, test:e2e, the standalone binary from a temp dir,
and MCPB validation — all green, plus new tests for the upgrade path (old records discoverable,
both command names work, no destructive migration). Stop before any domain registration, repo
rename, deploy, tag, or release. Report commits, exact verification commands + results, and the
handoff for Phase 6.
```

## Phases 6–9 (after Phase 5)

All detailed in [`plan.md`](plan.md); each externally-visible action is separately gated:

- **6 — Release + installer:** Release Please (manifest mode, draft, forced tags) + a gated per-OS binary/MCPB matrix; `install`/`install.ps1` on the approved Cloudflare domain with SHA-256 verification; `diffle update` on the same path.
- **7 — Docs site:** Astro Starlight with D5 tokens; retire `site/` + the Pages workflow.
- **8 — Demos:** Remotion under `demos/` driven by Playwright captures.
- **9 — Release-readiness:** remove transitional flags/dead assets, refresh all docs, run the full matrix from a clean checkout.

Nothing in 5–9 has started. Stop before any domain registration, repo rename, deploy, tag, or release unless explicitly approved.

> Note: Phases 5, 6, and 9 still use the placeholder version constant `0.16.0` in `client/src/lib/whatsNew.ts`; Phase 5 wires the real version. User-level What's-New "seen" state persists to `~/.loupe/state.json` via `homedir()` (moves to the resolver in Phase 5).
