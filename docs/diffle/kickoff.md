# diffle — ultracode kickoff prompt

Paste the block below into a **fresh ultracode session opened in this repo** (so it inherits `CLAUDE.md`/`AGENTS.md` and project memory). It's self-contained and leans on the committed docs as the source of truth. See also [plan.md](plan.md), [design.md](design.md), and ADRs [0004](../adr/0004-rename-loupe-to-diffle.md)/[0005](../adr/0005-svelte-vite-drop-buildless.md)/[0006](../adr/0006-distribution-binaries-install-script.md).

To have it do only the first slice, append: *"Do Phase 0 and the doc/config cleanup only, then stop and report."*

---

```
diffle — implementation kickoff (ultracode)

You're picking up a planned rewrite. The name is diffle (formerly "loupe"). Do NOT
re-litigate naming, stack, palette, or distribution — those are decided and committed.

FIRST, orient (don't skip):
- You're on branch `evolve` (confirm; it exists). Work here.
- Read these committed docs — they are the source of truth:
  - docs/diffle/plan.md         (phased implementation plan, Phase 0 → 9)
  - docs/diffle/design.md       (D5 dark-indigo palette tokens, type, motion stack, craft floor)
  - docs/adr/0004-rename-loupe-to-diffle.md
  - docs/adr/0005-svelte-vite-drop-buildless.md
  - docs/adr/0006-distribution-binaries-install-script.md
  - AGENTS.md (current constraints — several are being intentionally dropped; see below)
- Also read the codebase you're replacing: src/index.ts, src/server/*, src/core/*,
  src/mcp/*, src/types.ts, and the buildless client under src/client/*.

WHAT'S BEING BUILT:
diffle is a local Git diff review tool — a dev runs a CLI, it opens a browser UI to
review the working diff, leave inline comments, and return structured feedback to
coding agents (Claude Code, Codex) over MCP. Tagline (deadpan): "Deterministic
Inspection & Feedback Framework for Language-model Engineering."

LOCKED DECISIONS (build to these, don't reconsider):
- Client: full rewrite as a Svelte 5 (runes) SPA — Vite + Tailwind v4 + shadcn-svelte.
  NOT SvelteKit. Tailwind theme tokens generated from the D5 palette in design.md.
- Keep Bun as the server/CLI/MCP runtime and `bun build --compile` binary compiler.
- The buildless constraint is DROPPED. Vite emits static assets that Bun.serve hosts;
  repoint clientDir from src/client to the Vite build output.
- Preserve the server API routes and src/types.ts as the single source of truth for
  shared shapes (diff JSON, Review Records, .review, API/MCP bodies) — import, never redefine.
- Client state = domain rune stores (diff, comments, review, prefs, ui); no prop-drilling
  (kills the current src/client/app.js god-component pattern).
- Testing: keep `bun test` for pure core/server; add Vitest + @testing-library/svelte for
  components; Playwright for one end-to-end smoke.
- Distribution (later phase): install-script + prebuilt Bun binaries on GitHub Releases,
  self-contained MCPB per-OS, package managers fast-follow. See ADR 0006.

HOW TO EXECUTE (ultracode):
Run the plan phase by phase using Workflow orchestration, staying in the loop between
phases — do NOT attempt the whole thing in one workflow. Recommended order:
1. Phase 0 (tooling scaffold) FIRST, plus the rewrite-independent cleanup: replace the
   root DESIGN.md with docs/diffle/design.md's system, and strip the buildless
   hard-constraint + 200-line client-module cap + htm notes from AGENTS.md and CLAUDE.md
   (they now fight the new stack).
2. Then Phases 1→3 (stores → component migration → motion), verifying each component in a
   real browser before calling it done (green tests ≠ working UI). Apply the craft floor
   in design.md (no hero kicker, themed browser surfaces, contrast tinted from the hue, etc.).
3. Packaging/distribution/docs/demos (Phases 4→8) after the app reaches parity.
Keep `bun test` and `bun x tsc --noEmit` green throughout. Commit per concern
(Conventional Commits, no attribution lines). Report at each phase boundary and pause
for review before the next.

NOTES:
- The name swap across package.json / MCPB / marketplace / repo (Phase 6) is deferred;
  route identity strings through one config module so it's a single change.
- Open user-side items (not build blockers): register diffle.sh, secure the difflehq
  GitHub org, quick trademark sweep.
- The visual mockups (app/landing/docs in the D5 palette) exist as a private design canvas;
  design.md captures the exact tokens, so you don't need the canvas to build.

Start by confirming the branch, reading the docs above, then propose your Phase 0 workflow.
```
