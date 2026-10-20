# diffle — implementation handoff (Phases 0–9 done → gated release actions)

> Written when the product was called diffle (and loupe before it). Kept as history; the name is now nittle, see [ADR 0008](../adr/0008-rename-diffle-to-nittle.md).

## Rename to nittle (2026-10-17)

Epic #206 renames the product from diffle to nittle (why: [ADR 0008](../adr/0008-rename-diffle-to-nittle.md)). This section is the resume ledger, current as of 2026-10-19 late evening. Everything below it is the diffle-era history and stays as written.

### Running from source (.env)

Bun loads `.env` from the cwd before any user code runs, and the cwd is the repository under review. The compiled binary is built with `--no-compile-autoload-dotenv`. From source, use the `bun start`, `bun run dev`, `bun run preview` and `bun run mcp:serve` scripts, or the shebang on `src/index.ts`, `src/mcp/index.ts` and `scripts/dev.ts`; all pass `--no-env-file`. A plain `bun src/index.ts` cannot protect itself from inside the script, so add `--no-env-file` yourself when running it in a repository you do not trust.

### Authority for a resumed session

The run's authority came from the run brief (`.orchestra/runs/nittle-vnext-20261017/brief.md`, local and gitignored). A fresh session must re-read that brief and confirm it is still in force before it merges release PRs, publishes anything, merges web/ changes (they deploy live), touches Cloudflare, or touches Cody's real home. Nothing in this file grants authority by itself.

### State

v0.29.0 is released (the rename). nittle.dev is live, diffle.dev answers every URL with a 301 to the same path and query on nittle.dev, and a real `diffle update` from 0.28.1 to 0.29.0 passed on ubuntu, macos and windows (14, 14 and 13 checks, live smoke run 39336050970). In flight: the language server client halves (#181 to #184), the detached worktree server (#186, PR #261), the fixes from the rename verify pass (PR #269), and Release Please PR #259 (0.30.0).

### Done

| issue | PRs | outcome |
| --- | --- | --- |
| #207 | #215 | product identity, binary and migration runner switched to nittle |
| #208 | #222 | data dir, env vars and prefs migrate to `~/.nittle` (symlink alias, lock, fail-closed process check) |
| #209 | #223 | diffle and loupe review plugins and MCP configs swap to nittle; `doctor` per agent |
| #210 | #241 | installers, `nittle-*` assets plus `diffle-*` transition copies, update path from 0.28.x; upgrade smoke on 3 OSes |
| #211 | #217 | client UI renamed, What's New entry for 0.29.0 |
| #212 | #257, #258 | docs site on nittle.dev; Worker serves nittle.dev and diffle.dev via wrangler routes |
| #213 | #218 | repo docs renamed, ADR 0008, `docs/diffle` to `docs/nittle` |
| #199 | #225 | visual regression: 26 snapshot tests in a pinned container; follow-up #227 |
| #175 | #239 | keymap grammar (counts, chords), line cursor, hunk jumps, jump history |
| #176 | #247 | comment on a line, visual range or file by key; follow-ups in #250 |
| #177 | #246 | `/` file search with `n` and `N` |
| #178 | #235, #255 | `GET /api/search` (regex in a killable worker, caps), then the `g/` results panel; follow-ups in #267 |
| #180 | #232 | language server pool: framing, cancellation, lazy start, restart-once, status |
| #181 to #184 server half | #245 | definition, hover, references and symbols endpoints; CI bench cold 1227 ms, warm p95 2.8 ms |
| #187 | #229, #230 | `--wait` blocks for review feedback; `--json` help corrected |
| #190 | #224 | `nittle show [rev]` reviews one commit; option and field injection closed |
| #192 | #268, #270 | suggestion blocks in comments and the compiled prompt; #270 restored the visual baselines |
| #198 | #236 | completions for bash, zsh, fish and powershell from one table |
| #195, #196 | #251 | npm shim and platform packages, brew and scoop renderers, gated publish jobs, actionlint in CI (issues stay open until Cody enables publishing) |
| safety | #219 | tests get an isolated home; migrations run only from a compiled binary (D22) |
| security | #240 | loopback Host guard on every route, loopback bind |

Closed and replaced by a rebuilt PR (linear history, no force-push): #216, #221, #226, #228, #231, #233, #234, #238, #242, #243, #244, #252, #254, #260.

### In progress

| PR | what | waiting on |
| --- | --- | --- |
| #269 | fixes for #262 to #266 from the verify pass, one commit per issue | final CI and merge; review round 2 had no blocking findings, auto-merge armed |
| #261 | #186 detached worktrees for non-checked-out revisions | round 2 fixes (fsmonitor during probes, ownership record written before creation), then lead verification |
| #259 | Release Please 0.30.0 | merge after #269 and #261 land; the What's New version must equal the release version (0.30.0) before merging (D19) and the changelog range is not whole-history |
| dependabot | #253, #173, #168, #166, #163 | triage; #163 is the high alert on source-map-js in `demos/` |

Client work for #181 to #184 (keys `gd gy gh gA gs gS`, hover card, pickers, read-only view, e2e in the ubuntu lsp job) has a worker running and no PR yet.

### Remaining queue

- #181 to #184 client halves (in progress).
- #185 language registry, status command, overrides (pending).
- #186 (PR #261, in review).
- MKT (pending).
- The K, H, L and D verify passes.
- Second parity audit (the five-merge trigger is long past).
- Flaky test hunt: a worker is on the split-panes 390px drag e2e, load-dependent `bun test` failures (lspNavigation, an MCP stdio timeout), and the bash completion tests under Git Bash.
- Demo media render, deferred (D30). Tell Cody first, concurrency 2, 12 percent free RAM kill guard.
- Installer completions offer (snippets in the run's tmp, `installer-completions-198.md`).
- Open follow-up issues: #227, #249, #250, #256, #267, plus #262 to #266 until #269 merges.
- Epic and tracking issues still open: #206, #214, #179, #195, #196, #126.
- Proposed: parallel `site-check` runs can pass against the previous deployment before the Workers build finishes; verify the deployed revision instead.

### Decisions with evidence

- D1 name is nittle (nit + le); nittle.dev registered 2026-10-16.
- D2 work in a dedicated worktree off origin/main.
- D3 time budget 48h wall clock, no token cap.
- D4 the independent verify pass runs through a second model CLI with computer-use tools; checked 2026-10-17.
- D5 closed as not wanted: #197, #202, #203, #205. Do not reopen.
- D6 bot review comments are not the gate; the local read-only review is.
- D7 full rip-and-ship authority within the run brief.
- D8 no diffle or loupe alias (Cody, epic #206 update).
- D9 atomic rename to `~/.nittle`, merge records by id if both exist, delete `~/.diffle` only after the data is confirmed (Cody, #208 update).
- D10 how many releases keep the `diffle-*` transition assets: set to 3 (`TRANSITION_ASSET_RELEASES`, PR #241).
- D11 only the installer's marker block in the shell rc file is replaced; nothing else in a profile is touched.
- D12 `PRODUCT.repository` stays `codywilliamson/diffle` until the repo is renamed (#214), then a one-line PR flips it.
- D13 no release until set R is merged and nittle.dev is live. Followed: release #248 merged 2026-10-19T21:34Z.
- D14 the migration runs on the first invocation of the new binary, because the 0.28.x updater swaps the binary and never runs it.
- D15 #207 does the mechanical rename including plugin dirs and adds the empty migration runner; #208, #209 and #210 each add a step.
- D16 review gate is a read-only exec run against `git diff origin/main...HEAD`, because `--base` and a prompt cannot be combined; two rounds max.
- D17 resolved bot threads are required by the main ruleset, so the lead replies and resolves them (evidence: #215 sat BLOCKED on 3 threads).
- D18 `~/.diffle/bin` belongs to the #210 install step; the #208 data migration never moves it.
- D19 What's New version 0.29.0 matches the release PR (checked on #248).
- D20 Worker keeps the name `diffle` because Workers Builds is bound to it. Superseded in part by D33.
- D21 never force-push; a rebased branch goes under a new name (`-v2`). One logged exception: 9d2e2e5 before any PR existed.
- D22 incident, 2026-10-17 16:43Z to 16:49Z: worker tests on unmerged #208 and #209 ran migrations against Cody's real home. Fixed by #219. Restore is P1.
- D23 upgrade smoke in two layers: a simulated swap on every PR (3 OSes), and a live `diffle update` after release.
- D24 web/ deploys on merge to main, so #212 was held until the release was published.
- D25 parity audit 1: 63 rows, 15 ahead, 24 parity, 24 behind; uncovered axes parked as P2.
- D26 (Cody) all code changes go to workers; the lead triages, verifies and merges.
- D27 one keymap grammar for #175 to #178 and LSP (`keymap-spec.md` in the run dir); chords `gd gy gh gr gs gS` were reserved. `gA` is the references key: issue #183 replaced the reserved `gr` with `gA`.
- D28 LSP status has a sixth state, `idle`.
- D29 the Windows UAC prompt is likely the sandbox service of the review tool, not the product; every review prompt carries a no-execution rule. Note: `tests/installPs1.test.ts` runs a fake text `nittle.exe`.
- D30 (Cody) ship 0.29.0 without regenerated demo media; render later when idle.
- D31 Esc cancels a pending count first, then closes the topmost layer.
- D32 (Cody) after the pause, the remaining budget is about 31h of active time from 2026-10-19T20:47Z.
- D33 nittle.dev attaches through `wrangler.jsonc` routes (the installed `cf` has no Workers custom-domain command); the routes must list both domains because wrangler reconciles (#258 review). The 301 is a zone ruleset.
- D34 detached LSP worktrees link the user's `node_modules`; accepted risk is a server writing through the link, mitigated by typings acquisition off, no configured write paths, and unlink-only removal (tested byte-identical).

### Cloudflare commands run

Custom domain, D33. `cf` cannot attach a Worker custom domain, so PR #258 added to `wrangler.jsonc`:

```
routes: both nittle.dev and diffle.dev, each { "pattern": ..., "custom_domain": true }
```

`wrangler deploy --dry-run` exited 0 (it does not print routes). Workers Build on 41494a5 succeeded. nittle.dev `/`, `/install` and `/install.ps1` returned 200 and diffle.dev stayed 200 until the ruleset.

Redirect, zone diffle.dev (7358a1d616725100067a6ec85de2adf0). Step 1, dry run (the command was given the zone by name, which is why the output URL shows `zones/diffle.dev`):

```
cf rulesets account-rulesets create --zone 7358a1d616725100067a6ec85de2adf0 \
  --kind zone --phase http_request_dynamic_redirect --rules <rules> --dry-run
```

```
{
  "command": "cf rulesets account-rulesets create",
  "method": "POST",
  "url": "https://api.cloudflare.com/client/v4/zones/diffle.dev/rulesets",
  "pathParams": { "account-or-zone": "zones", "account-or-zone-id": "diffle.dev" },
  "query": {},
  "bodyKind": "json",
  "body": {
    "description": "Permanent redirect of every diffle.dev URL to the same path and query on nittle.dev (product rename, issue 212)",
    "name": "diffle.dev to nittle.dev",
    "kind": "zone",
    "phase": "http_request_dynamic_redirect",
    "rules": [
      {
        "description": "diffle.dev/* 301 to nittle.dev/*, path and query preserved",
        "expression": "(http.host in {\"diffle.dev\" \"www.diffle.dev\"})",
        "action": "redirect",
        "action_parameters": {
          "from_value": {
            "status_code": 301,
            "target_url": {
              "expression": "concat(\"https://nittle.dev\", http.request.uri.path)"
            },
            "preserve_query_string": true
          }
        },
        "enabled": true
      }
    ]
  }
}
```

Step 2, a separate validate-only run against the zone id: exit 0, nothing created (the list showed 0 dynamic_redirect rulesets). Step 3, real create: ruleset id a217cae4c9e14483b49896842b467ee9, rule id 3bfd1bba3a924d81be0d09800f823423, version 1.

Proof: `curl -sSI` on diffle.dev `/`, `/install`, `/install.ps1` and `/getting-started/installation/?x=1` returned 301 with `Location: https://nittle.dev/<same path>?x=1`. nittle.dev `/`, `/install` and `/install.ps1` returned 200. `scripts/check-site.sh` printed "site check passed". `curl -fsSL https://diffle.dev/install | sh` fetched the nittle installer through the redirect (it stopped on unsupported OS MINGW, expected on Windows). `irm https://diffle.dev/install.ps1 | iex` into an isolated temp home installed nittle v0.29.0 with sha-256 verified, and `nittle --version` printed v0.29.0 plus the lineage line.

### Cody's manual list

- P1 (D22), optional: restore the local diffle install the run's tests changed. Data was moved, not lost. Cody does this himself, never an agent. First check which dirs exist (`ls -d ~/.diffle ~/.nittle`). Rename only when `~/.diffle` is absent and `~/.nittle` is present (`mv ~/.nittle ~/.diffle`). If both exist, move nothing and let nittle's own migration merge them (it parks conflicts). Then `claude plugin marketplace add codywilliamson/diffle` and `claude plugin install diffle-review@diffle-local --scope user`, then re-add the diffle-review plugin in your other agent if used. Optionally set `seenVersion` back in `~/.diffle/state.json`. Nothing depends on this.
- P2 (D25), say which to add: (a) ranges `a...b`, worktree on either side, commit stepping; (c) remote and reverse-proxy use (`--host`, allowed-origin guard, relative asset paths); (d) a `nittle config` command; (e) arm64 runners (ubuntu-24.04-arm, windows-11-arm) in the CI matrix. (b) was dropped, `linguistGenerated()` already exists.
- P3 (#195, #196): turn on distribution, steps below.
- #214: rename the GitHub repo to `nittle`, then flip `PRODUCT.repository` (and the `REPO` slug in `install.sh` and `install.ps1`) in a one-line PR; claim the nittle names on npm and crates.io; handles and trademark search; repo description, topics and website; comment the new name on #126.
- Make `e2e visual` a required check on main (ruleset change). #268 merged with it red.

Distribution enable steps. Nothing publishes until these are done. Four release jobs are gated: `npm-publish`, `npm-smoke`, `tap-publish` and `brew-scoop-smoke`. Each is skipped unless its repo variable is `true`.

0. Do the repo rename and flip `PRODUCT.repository` first. npm provenance checks `repository.url` against the repo that ran the workflow, so the first npm publish fails otherwise. Brew and Scoop work either way.
1. npm (#195):
   - Log in on npmjs.com with the owning account.
   - Check `npm view nittle` is free. If taken, use a scope such as `@codywilliamson/nittle` and tell the lead; the name lives in `src/core/npmPackage.ts` and the updater hint.
   - Trusted publishing needs an existing package. Cody runs these himself, one package at a time, after reading each manifest. In a new empty scratch dir per package (never inside this repo), write a `package.json` containing exactly `{"name": "<package>", "version": "0.0.0"}`, then inspect with `npm publish --access public --dry-run`, then publish with `npm publish --access public`. The seven names: `nittle`, `nittle-linux-x64`, `nittle-linux-arm64`, `nittle-darwin-x64`, `nittle-darwin-arm64`, `nittle-win32-x64`, `nittle-win32-arm64`.
   - For each package: Settings, Trusted Publisher, GitHub Actions. User `codywilliamson`, repository `nittle` (or `diffle` until renamed), workflow `release.yml`, environment blank.
   - Set repo variable `NPM_PUBLISH` to `true`. No npm token is needed.
2. Homebrew and Scoop (#196):
   - Create public repos `codywilliamson/homebrew-tap` and `codywilliamson/scoop-bucket`, each with a README and an initial commit on `main`. If you pick other names, set repo variables `TAP_REPO` and `BUCKET_REPO` to `owner/name`.
   - Create a fine-grained token: resource owner `codywilliamson`, only those two repos, Contents read and write, with an expiry.
   - Add it as repo secret `DIST_REPO_TOKEN`, and set repo variable `TAP_PUBLISH` to `true`.
3. After the next release PR merges, `npm-publish`, `npm-smoke`, `tap-publish` and `brew-scoop-smoke` should pass. Then try `npx nittle --version`, `brew install codywilliamson/tap/nittle` and `scoop bucket add nittle https://github.com/codywilliamson/scoop-bucket; scoop install nittle/nittle` once by hand. Drop the "coming soon" label in the README and installation page after the first publish (snippets in `docs-195-196.md` in the run's tmp). To turn a channel off, set its variable to anything but `true`. The release never depends on these jobs.

### Open risks

- The 0.28.1 updater reads any API failure (rate limit, network) as "already on the latest release". A user behind a blocked API never sees the upgrade, and the live smoke needed a rerun once. Tracked in #256 (retry in the smoke plus a clearer message; the old binary itself cannot change).
- A conflicting legacy record is kept in `~/.diffle` instead of moving under `~/.nittle`, so `~/.diffle` cannot be fully removed. Tracked in #266, fix in #269.
- Detached worktrees for #186 link the user's `node_modules` (D34). A language server could in theory write through the link. Mitigated, not eliminated.
- Flaky tests under load: split-panes 390px drag e2e, bash completion tests on Git Bash, lspNavigation, an MCP stdio timeout. Cap concurrent workers at about 4 until the hunt lands.
- `diffle-*` transition assets must keep shipping for 3 releases or 0.28.x updaters strand.
- Published demo media still shows the diffle wordmark until the render (D30).
- The repo slug is still `codywilliamson/diffle`; the old name clash on #126 stays until the rename.

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

**Post-review polish (dogfooding pass, all committed):** rebuilt the **feedback preview modal** (`review/FeedbackPreview.svelte`, rendered/raw + copy, opened from the review popover); **restored the sidebar resize handle** (`Resizer.svelte`); fixed the **sticky file header** (`overflow-hidden` was breaking `position: sticky`); **collapse deleted files by default** (GitHub-style); **side-by-side panes locked 50/50** with per-cell horizontal scroll (`table-layout: fixed` + colgroup — a long line no longer shoves the new pane off-screen); pinned + width-capped the **inline comment box** on wide diffs; readable comment **tag badges**; **refresh icon spins** while re-running; a **theme crossfade** (View Transitions API); folder **collapse animation**; and a general **motion pass** (cubic-out easing, popover/diff reveals). `DESIGN.md` now holds the full D5 system; `docs/nittle/design.md` points to it.

**Gate (all green):** `bun test` 204 · server `tsc` 0 · Vitest 83 · svelte-check 0 · Playwright 7 · client build · binary compile · MCPB validate. Browser-verified at desktop + phone, light + dark, including the review/comment/feedback flows. **Phase 4 also verified the compiled `dist/loupe.exe` from a temp dir with the source tree unavailable:** `--version`, CLI review (embedded `index.html`/JS/CSS served with correct MIME + a 404 for missing/traversal paths), `/api/diff`, `/api/update` (no crash on the non-repo install root), and `mcp serve` all work from only the binary.

### Open `evolve` enhancement backlog (GitHub issues, labeled `enhancement` + `evolve`)

Out-of-scope items found while dogfooding — deferred, not lost:
- **#23** — broader syntax highlighting: done. Shiki (oniguruma wasm, lazy per-language grammars) replaced highlight.js; hunks are tokenized per side and seeded with the new-side file context, so embedded languages (svelte/vue/astro) highlight correctly.
- **#24** — independent per-pane horizontal scroll + a draggable split divider (the 50/50 fix above is the interim; true per-pane scroll/resize needs a non-table rebuild).
- **#25** — fuller motion: done. NumberFlow counts (top-bar ±, unresolved badges), a staggered row reveal on diff mount (`revealRows`), and a single-file-mode tree row → diff header View Transition morph (`morphInto`), all reduced-motion gated in code. GSAP was not added — no sequence needed it.
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
- **Intentional simplifications** vs old loupe (all tracked as `evolve` issues, see backlog above): side-by-side is a single `table-layout: fixed` table — panes stay 50/50 and long lines scroll per-cell, but true per-pane scroll + a draggable split divider are not implemented (**#24**). Motion shipped the foundational transitions + FLIP + theme crossfade, then NumberFlow counts, staggered row reveals, and the file→diff morph (**#25**). What's-New uses a placeholder version constant `0.16.0` in `client/src/lib/whatsNew.ts` (real versioning is Phase 6). User-level What's-New "seen" state persists to `~/.loupe/state.json` via `homedir()` — **not** `LOUPE_DATA_DIR` (which only moves review records).
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
- **`docs/nittle/handoff.md`** (this file) — the living status doc; keep it current each phase.
- **`docs/nittle/plan.md`** — the original phase plan; still the roadmap for phases 8–9. Retire or fold into README/handoff in Phase 9.
- **`README.md`** — refreshed for diffle in Phase 9 (curl/irm install, `diffle` command, `~/.diffle`, Phase-8 media). Current.
- **`web/`** docs site — live at diffle.dev, polished in Phase 9 with the Phase-8 hero video + screenshots. Current.
- Explicitly **out of scope** (dropped by the user): install scripts detecting/cleaning old `~/.loupe` dirs — not worth it for a tiny user base.

> Note: `client/src/lib/whatsNew.ts` and `package.json` are at `0.16.0`; Release Please owns the next bump. `loupe`/`LOUPE_*`/`~/.loupe` compatibility is load-bearing until the first diffle release ships — remove it only after that release (deliberately deferred past Phase 9). User-level What's-New "seen" state persists to `<data dir>/state.json` (diffle-preferred, loupe-fallback) via `homeDataDir()`, not `DIFFLE_DATA_DIR`.
