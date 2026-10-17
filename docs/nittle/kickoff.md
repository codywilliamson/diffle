# diffle — Claude UltraCode kickoff

Paste the block below into a fresh Claude UltraCode session opened at the repository root. It deliberately executes only Phase 0. Review that checkpoint before starting Phase 1; do not turn the entire rewrite into one workflow.

```
diffle Phase 0 — baseline and Svelte scaffold

You are implementing the planned evolution of loupe into diffle. Use Workflow
orchestration for this bounded phase, parallelizing only independent work. Do not stop
after proposing a plan: inspect the repository, execute Phase 0, verify it, commit each
coherent concern with Conventional Commits, then stop and report.

Start by confirming all of the following:
- The current branch is `evolve`. Do not create or switch branches.
- Read `AGENTS.md`, `CONTEXT.md`, and the relevant ADRs before changing code.
- Read these source-of-truth documents in order:
  1. `docs/diffle/plan.md`
  2. `docs/diffle/parity.md`
  3. `docs/diffle/design.md`
  4. `docs/adr/0004-rename-loupe-to-diffle.md`
  5. `docs/adr/0005-svelte-vite-drop-buildless.md`
  6. `docs/adr/0006-distribution-binaries-install-script.md`
- Inspect `src/types.ts`, `src/index.ts`, `src/core/reviewLaunch.ts`, `src/server/*`,
  `src/mcp/*`, packaging scripts, and the current `src/client/*` behavior. Treat the old
  client as executable acceptance evidence, not as a module layout to copy.
- Inspect `git status` and preserve all pre-existing work. If the tree is not clean,
  distinguish existing changes from yours and do not overwrite them.

Product and architecture decisions are locked for this phase:
- The new client is a Svelte 5 runes SPA built by Vite, with Tailwind v4 and
  shadcn-svelte. Do not add SvelteKit.
- Bun remains the server, CLI, MCP runtime, test runner, and executable compiler.
- `src/types.ts` remains the only shared contract definition. Import its types; never
  recreate them in the client.
- New source lives under `client/`; Vite output is `dist/client`.
- D5 light and dark semantic variables in `docs/diffle/design.md` are canonical.
  Tailwind and shadcn variables must alias them instead of creating a parallel palette.
- This is a rewrite branch: make the Svelte shell the default in Phase 0. Do not build a
  Preact fallback, feature flag, or dual-client router. Keep `src/client` only as read-only
  parity evidence for later phases; it does not need to remain runnable.
- A later standalone build will generate static `with { type: "file" }` imports for every
  Vite asset and embed them in the executable. The current Bun 1.3.14 does not expose the
  newer `compile.assets`/`--asset` interface, so do not build around it, sidecar assets, or
  an installed checkout.

Execute Phase 0 from `docs/diffle/plan.md`:

1. Capture the baseline before edits:
   - `git status --short`
   - `bun test`
   - `bun x tsc --noEmit`
   - current binary build and MCPB validation
   - a real-browser desktop and phone-width smoke of the current client
   Keep temporary screenshots out of tracked product media.

2. Reconcile `docs/diffle/parity.md` with the live client while inspecting it. If the
   checklist missed a current behavior, update the checklist before coding. Do not widen
   Phase 0 into implementing that behavior.

3. Add pinned Svelte 5, Vite, Tailwind v4, shadcn-svelte, Vitest, Testing Library, and
   Playwright setup. Keep packages in devDependencies unless runtime code genuinely imports
   them. Do not add GSAP, NumberFlow, Astro, or Remotion yet; those belong to later phases.

4. Work red → green through these agreed public seams, one vertical slice at a time:
   - Vitest: first write a failing behavior test for the typed `/api/diff` request and
     server error text, then implement only the adapter needed to pass it.
   - Testing Library: first write a failing user-facing test for loading, successful diff
     context, and API-error states, then implement the smallest Svelte shell needed to pass.
   - Playwright: first write a failing tracer bullet that launches a production preview
     against a temporary Git fixture and receives a real diff, then implement the runtime
     wiring needed to pass it.
   Observe and record each red state before implementation. Do not test private rune-store
   or component internals, and do not write all tests before starting the first slice.

5. As those tests drive the shell, add under `client/`:
   - D5 semantic variables for both themes
   - Tailwind `@theme inline` and shadcn aliases backed by those variables
   - typography and themed selection/caret/scrollbar/focus surfaces
   This is scaffold evidence, not a partial visual rewrite.

6. As the Playwright tracer drives runtime wiring, repoint `bun start` and production
   preview to `dist/client`. Add one cross-platform `bun run dev` entry that launches a
   real review backend and Vite together, proxies `/api` to that exact backend, preserves
   the generated `?review=` query, opens the Vite URL, and tears both processes down
   cleanly. Do not add a public CLI option, fallback, or alternate legacy-client path.

7. Make root `DESIGN.md` a short pointer to `docs/diffle/design.md`; do not duplicate the
   palette. Update `AGENTS.md` only after the scaffold exists: remove buildless/htm rules
   and the blanket client line cap, document Svelte source/output plus the read-only legacy
   reference, and retain server/core rules that remain true. `CLAUDE.md` is only
   `@AGENTS.md`; do not
   duplicate or replace it.

Verification and scope controls:
- Verify `bun start`, the dev path, and production-preview path with the Svelte shell in a
  real browser at desktop and phone widths, in light and dark modes, including reduced motion.
- Finish with `bun test`, `bun x tsc --noEmit`, the new client test command, Playwright
  smoke, production client build, current binary build, and MCPB validation all green.
- Do not register a domain, create a GitHub org, rename the repository, deploy, tag, release,
  or change package/binary/plugin identity in this phase.
- Do not start Phase 1 or make unrelated cleanup edits. Leave the old source available as
  reference; no old-client runtime path is required.

At the end, report:
- commits created
- exact verification commands and results
- browser paths and viewport/theme coverage checked
- any parity item or repository contradiction discovered
- the concrete handoff for Phase 1
Then stop for review.
```
