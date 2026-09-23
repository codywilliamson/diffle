# diffle — implementation handoff (Phases 0–9 done → gated release actions)

> Branch: `evolve`. The Svelte rewrite is complete, the binary is **self-contained**, the product is **rebranded loupe→diffle** (with loupe/`LOUPE_*`/`~/.loupe` compatibility for one release), the **release + installer channel** is wired (update check, `diffle update`, cross-target build, installers, Release Please), an **Astro Starlight docs site** (`web/`, live at diffle.dev via Cloudflare) is built + polished with real demo media, and **Phase 8 product demos** ship a Playwright-capture + Remotion pipeline under `demos/`. The domain **diffle.dev is registered** and the **GitHub repo is `codywilliamson/diffle`**. Phases 0–9 are committed and verified. **All that remains are the user's gated external actions: cut the first GitHub release, and — only once that ships — remove the loupe/`LOUPE_*`/`~/.loupe` compatibility layer.** This doc lets a fresh session confirm state without re-deriving it.

## Status — what's done

| Phase | Outcome |
|---|---|
| 0 | Svelte 5 + Vite + Tailwind v4 + shadcn scaffold; D5 tokens; dev/preview wiring; baseline captured |
| 1 | Typed adapters for every endpoint; pure transforms; five rune stores composed via typed context |
| 2 | Full UI: shell, file index, unified + side-by-side diff, syntax + word highlighting, inline/range/file comments, large-file gate, wrap/single-file, sanitized markdown preview, stale comments, review panel + outcomes + feedback copy, sync notice + polling, help, What's New, update badge, legacy prompt, shortcuts |
| 3 | Reduced-motion-gated transitions, focus-trapping modal + Escape handling, svelte-check a11y clean, **removed `src/client`** |
| 4 | Self-contained binary: static serving behind an `AssetSource` seam (directory adapter for source/preview, embedded-import map for the binary); `scripts/build-binary.ts` vite-builds, embeds `dist/client` via generated `with { type: "file" }` imports, injects the version; MCPB staged from that one binary (no second client tree) |
| 5 | Rebrand loupe→diffle through one product config (`src/core/product.ts`): `diffle` command + package + binary, `loupe` kept as a deprecated bin alias; `productEnv()` reads `DIFFLE_*` then legacy `LOUPE_*`; `~/.diffle` for new users, existing `~/.loupe` kept in place (`homeDataDir`); `isProductBinary` recognizes both names; runtime labels + MCP server name + What's-New flipped; client prefs `diffle-*`/`loupe-*` migration was already wired in Phase 0. **loupe compatibility is load-bearing — keep it through the next release.** |
| 6 | Release + installer channel (code only; nothing released): update check via the GitHub Releases API + embedded version (`updateCheck.ts`, non-fatal offline); `diffle update` self-installs the latest asset with sha-256 verification + a Windows after-exit swap (`core/update.ts`, `core/updateTarget.ts`); `scripts/build-release.ts` cross-compiles all six targets + `checksums.txt`; `scripts/stage-mcpb.ts` is target-aware; `install.sh`/`install.ps1`; Release Please (`release-please-config.json`, `.release-please-manifest.json` at 0.16.0) + `.github/workflows/release.yml` (draft → build/upload per-target binary+MCPB → publish). |

**Phase 5/6 decisions worth knowing:** internal `loupeRoot` variable/param names were intentionally left as-is (not user-facing — renaming them is pure churn). The `github.io/loupe` docs URL was removed everywhere (new site pending) but `github.com/codywilliamson/loupe` repository URLs were kept (they work now and GitHub redirects after the rename). `package.json` was bumped to `0.16.0` and `.release-please-manifest.json` bootstraps Release Please there. Version bumped but **not tagged/released**.

The three parity contradictions from the Phase 0 audit are all **implemented** (not just decided): sanitized markdown preview (ADR 0007), focus-trapping dialogs, and empty/no-diff states.

**Post-review polish (dogfooding pass, all committed):** rebuilt the **feedback preview modal** (`review/FeedbackPreview.svelte`, rendered/raw + copy, opened from the review popover); **restored the sidebar resize handle** (`Resizer.svelte`); fixed the **sticky file header** (`overflow-hidden` was breaking `position: sticky`); **collapse deleted files by default** (GitHub-style); **side-by-side panes locked 50/50** with per-cell horizontal scroll (`table-layout: fixed` + colgroup — a long line no longer shoves the new pane off-screen); pinned + width-capped the **inline comment box** on wide diffs; readable comment **tag badges**; **refresh icon spins** while re-running; a **theme crossfade** (View Transitions API); folder **collapse animation**; and a general **motion pass** (cubic-out easing, popover/diff reveals). `DESIGN.md` now holds the full D5 system; `docs/diffle/design.md` points to it.

**Gate (all green):** `bun test` 204 · server `tsc` 0 · Vitest 83 · svelte-check 0 · Playwright 7 · client build · binary compile · MCPB validate. Browser-verified at desktop + phone, light + dark, including the review/comment/feedback flows. **Phase 4 also verified the compiled `dist/loupe.exe` from a temp dir with the source tree unavailable:** `--version`, CLI review (embedded `index.html`/JS/CSS served with correct MIME + a 404 for missing/traversal paths), `/api/diff`, `/api/update` (no crash on the non-repo install root), and `mcp serve` all work from only the binary.

### Open `evolve` enhancement backlog (GitHub issues, labeled `enhancement` + `evolve`)

Out-of-scope items found while dogfooding — deferred, not lost:
- **#23** — broader syntax highlighting: done. Shiki (oniguruma wasm, lazy per-language grammars) replaced highlight.js; hunks are tokenized per side and seeded with the new-side file context, so embedded languages (svelte/vue/astro) highlight correctly.
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
- **New dev deps (all dev, exact-pinned):** `@lucide/svelte`, `shiki`, `marked`, `dompurify` (client bundle); plus the Phase 0 toolchain. Runtime deps stay the MCP SDK + zod only.
- **Intentional simplifications** vs old loupe (all tracked as `evolve` issues, see backlog above): side-by-side is a single `table-layout: fixed` table — panes stay 50/50 and long lines scroll per-cell, but true per-pane scroll + a draggable split divider are not implemented (**#24**). Motion shipped the foundational transitions + FLIP + theme crossfade; NumberFlow/GSAP/staggered reveals are deferred (**#25**). What's-New uses a placeholder version constant `0.16.0` in `client/src/lib/whatsNew.ts` (real versioning is Phase 6). User-level What's-New "seen" state persists to `~/.loupe/state.json` via `homedir()` — **not** `LOUPE_DATA_DIR` (which only moves review records).
- Git shows `LF will be replaced by CRLF` on commits — normal on Windows, ignore.

## Phases 5–6 — done (rebrand + release channel)

Committed on `evolve`. Rebrand: `83ae184` (product config + command), `1dde07a` (env + data dir), `60b91be` (labels + MCP name), `e573c21` (binary/MCPB names + docs-url removal). Release channel: `40c236d` (update check), `f139c75` (`diffle update`), `03885c4` (cross-target build), `c34eabc` (installers + workflow). Verified: `bun test` 215 · `tsc` 0 · Vitest 83 · svelte-check 0 · Playwright 7 · standalone `dist/diffle.exe` from a temp dir (version, review under both `DIFFLE_*` and legacy `LOUPE_*`, `mcp serve` name `diffle`, `diffle update`) · MCPB validate (host + target-aware) · cross-compile of linux-x64 + windows-x64 + windows-arm64 with checksums.

## Phase 7 — done (docs site)

Committed on `evolve`: `42f04c1` (Astro Starlight site) + `chore: point repo urls at codywilliamson/diffle` + `feat(build): set diffle.dev as the product homepage`. The site is a **separate `web/` package** (Astro 7 + Starlight 0.42, build-only deps isolated from the app) themed with the D5 tokens: `getting-started/` (installation, quickstart), `guides/` (reviewing-changes, inline-comments, agent-feedback, migrating-from-loupe), `reference/` (cli, configuration, mcp-tools). `bun run build` copies the root `install.sh`/`install.ps1` into `web/public/` so the built site serves them at `/install` + `/install.ps1`. Verified: `bun run build` → 11 pages, browser-checked landing + a content page (D5 dark theme, sidebar order, Tabs/Steps/Aside render).

### Deploy — DONE
`diffle.dev` is **live**. A Cloudflare Workers Builds project `diffle` (account "S3 Hub") is connected to `codywilliamson/diffle` with **production branch `evolve`**, build `cd web && bun install && bun run build`, deploy `npx wrangler deploy` (static assets via root `wrangler.jsonc` → `web/dist`), a dedicated build token, and the custom domain `diffle.dev` (HTTPS). It auto-deploys on every push to `evolve`; `diffle.dev/install` serves the installer. Config lives in `wrangler.jsonc` + [`web/README.md`](../../web/README.md).

### Gated actions still pending (the user's)
1. **Cut the first release**: merge the Release Please PR (tags + drafts), let `.github/workflows/release.yml` build/upload the per-target binaries + `checksums.txt`, then publish. Until a release exists, `diffle update` and the installers resolve no asset ("could not resolve the latest release"). **Nothing has been tagged or released.**
2. **Retire the old `site/` + `.github/workflows/pages.yml`** — safe now that the CF site is live (Phase 9, or whenever). `pages.yml` is dormant since nothing touches `site/`.
3. GitHub repo **description + README** (the user is handling these).

Done since the last handoff: domain `diffle.dev` registered; repo renamed to `codywilliamson/diffle`, in-repo URLs flipped; `diffle.dev` wired as `PRODUCT.site` + manifest/plugin homepage; Cloudflare deploy live (`wrangler.jsonc`); `evolve` pushed to origin.

## Phase 8 — done (product demos)

A **separate build-only `demos/` package** (npm, React + Remotion, isolated like `web/` — app runtime deps untouched). Two pipelines share one live-backend harness (`demos/src/lib/backend.ts` launches the **real** diffle backend on a throwaway fixture; `fixture.ts` is a deterministic rate-limiter diff nested under a clean `api/` folder). All Playwright work is **node/tsx, never bun** (bun+playwright+windows hangs).
- **Video (the primary deliverable):** `demos/src/drivers.ts` has one driver per take — **comment, range (multi-line drag-select), modes, review, filetree** — each returning zoom windows + captions; a driver may set its own `fixture` (filetree uses `BIG_FIXTURE`, a 22-file nested diff, so filtering + scrolling are real). `record.ts` runs each in its own recording with a **visible synthetic cursor + paced typing**, emitting `public/footage/<id>.{webm,json}`. Remotion (`takes/Take.tsx` + `LongReel.tsx`) plays each footage with its zooms/captions; the reel stitches intro + takes + outro with **crossfades** (`@remotion/transitions`, not hard cuts) → per-take **shorts** (`out/<id>.mp4`) + a stitched **reel** (`out/walkthrough.mp4`, ~55 s) + a punchy README gif from the comment take (`walkthrough.gif`). The initial stills-slideshow composition was replaced by this real-footage pipeline (the user called the slideshow "a glorified ppt").
- **Stills:** `demos/src/capture.ts` still screenshots the six review states into `public/captures/` for the docs guide images.
- `scripts/render.mjs` renders shorts + reel + gif; `scripts/publish-media.mjs` copies the reel/gif/poster + stills into `docs/screenshots/` and `web/public/media/`. `public/captures`, `public/footage`, `out/` are gitignored; only the published reel/gif/stills are committed. The 4 shorts are regenerable (`npm run render`) and delivered to the user, not committed.
- Verified: every take browser-checked (real UI, dark brand, correct file/line scoping, cursor + zoom land on the composer/modal/filter), intro bookend rendered, demos `tsc --noEmit` clean.

## Phase 9 — done (release-readiness), except gated release actions

Committed on `evolve`: retire legacy pages site (`chore: retire legacy github pages site` — dropped `site/`, `pages.yml`, its gitignore rule); `chore(build): drop unused dev dependencies` (`tailwind-variants`, `@testing-library/user-event`); `docs: correct stale product docs for the svelte rewrite + rebrand` (`PRODUCT.md`/`CONTEXT.md`/`mcpb/README.md`); `docs: rewrite README for diffle + retire loupe-era media` (curl/irm install, `diffle` command, `~/.diffle`, refreshed Phase-8 screenshots; deleted the loupe-era numbered stills + `agent-review-walkthrough.*` + the superseded `docs/agent-review-walkthrough.md` and `docs/media-capture.md`); `feat(docs): embed the product walkthrough + screenshots on the site` (hero video + showcase + per-guide screenshots, browser-verified both pages).

**Kept intentionally (still gated):** the `loupe` bin alias, `LOUPE_*`, `~/.loupe`, and all migration docs — load-bearing until the first diffle release ships. `src/types.ts` (208 lines) is **consciously exempt** from the 200-line cap (splitting the contract would break the one-import-surface invariant) — recorded in `AGENTS.md`. `CHANGELOG.md`'s historical `github.io/loupe` entry left untouched (Release Please owns it).

### Gated actions still pending (the user's — do NOT do these without explicit approval)
1. **Cut the first release**: merge the Release Please PR (tags + drafts), let `.github/workflows/release.yml` build/upload per-target binaries + `checksums.txt`, then publish. Until then `diffle update` + installers resolve no asset.
2. **After the release ships**, remove the loupe/`LOUPE_*`/`~/.loupe` compatibility layer (the last transitional debt).
3. GitHub repo **description + README-on-GitHub** rendering (user's call).

Stop before any domain registration, repo rename, deploy, tag, or release unless explicitly approved.

### Doc state (for a fresh session)
- **`AGENTS.md`** — refreshed for diffle (identity via `src/core/product.ts`, self-contained binary, release channel, `web/`, current layout). Current.
- **`docs/diffle/handoff.md`** (this file) — the living status doc; keep it current each phase.
- **`docs/diffle/plan.md`** — the original phase plan; still the roadmap for phases 8–9. Retire or fold into README/handoff in Phase 9.
- **`README.md`** — refreshed for diffle in Phase 9 (curl/irm install, `diffle` command, `~/.diffle`, Phase-8 media). Current.
- **`web/`** docs site — live at diffle.dev, polished in Phase 9 with the Phase-8 hero video + screenshots. Current.
- Explicitly **out of scope** (dropped by the user): install scripts detecting/cleaning old `~/.loupe` dirs — not worth it for a tiny user base.

> Note: `client/src/lib/whatsNew.ts` and `package.json` are at `0.16.0`; Release Please owns the next bump. `loupe`/`LOUPE_*`/`~/.loupe` compatibility is load-bearing until the first diffle release ships — remove it only after that release (deliberately deferred past Phase 9). User-level What's-New "seen" state persists to `<data dir>/state.json` (diffle-preferred, loupe-fallback) via `homeDataDir()`, not `DIFFLE_DATA_DIR`.
