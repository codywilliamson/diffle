# diffle — the evolution

> **diffle** — the *Deterministic Inspection & Feedback Framework for Language-model Engineering*. (It is a diff tool. The acronym is doing a bit.)

The `evolve` branch turns loupe into **diffle**: a frontend rewrite, a rebrand, and a modernized distribution + docs setup. This folder is the durable record of that initiative.

## What's changing (and why)

- **Name:** loupe → **diffle** — "loupe" is badly collided (npm, an active competitor, GNOME's image viewer). See [ADR 0004](../adr/0004-rename-loupe-to-diffle.md).
- **Stack:** drop buildless; **Svelte 5 + Vite + Tailwind v4 + shadcn-svelte**, keeping **Bun** as the runtime + binary compiler. See [ADR 0005](../adr/0005-svelte-vite-drop-buildless.md).
- **Distribution:** Release Please orchestrates versioning and GitHub Releases; project workflows build the self-contained executables, MCPBs, checksums, and installer channel. Package managers follow after the primary path is proven. See [ADR 0006](../adr/0006-distribution-binaries-install-script.md).
- **Brand:** dark-first, single indigo accent ("D5"). See [design.md](design.md).
- **Docs:** GitHub Pages → **Astro Starlight** on Cloudflare. **Demos:** **Remotion**. (In [plan.md](plan.md).)

## Documents

- [plan.md](plan.md) — phased implementation plan (incl. the cleanup workstream).
- [design.md](design.md) — brand & design system (D5 palette tokens, type, motion, craft floor).
- [parity.md](parity.md) — behavioral acceptance contract for replacing the current client.
- [kickoff.md](kickoff.md) — the bounded Phase 0 prompt for a fresh Claude UltraCode session.
- ADRs: [0004 rename](../adr/0004-rename-loupe-to-diffle.md) · [0005 stack](../adr/0005-svelte-vite-drop-buildless.md) · [0006 distribution](../adr/0006-distribution-binaries-install-script.md).

## Preserved

The server (`Bun.serve` router/handlers, git/diff/review-record core, stdio MCP mode) and the `src/types.ts` contract are kept. On `evolve`, the Svelte client becomes the default in Phase 0. The Preact source is retained only as parity evidence until the replacement covers it.

## Public-release gates

- Recheck and register `diffle.sh`, run a software-trademark search, and secure `difflehq` or `usediffle` before the external identity changes. The 2026-09-20 availability check was favorable but is time-sensitive; the bare GitHub handle is an unrelated user.
- Repository rename, deployment, tags, and releases are separate explicit actions. Local implementation does not need to wait for them until the rebrand/distribution gate.
- Run one bounded Claude UltraCode workflow per phase, starting with [kickoff.md](kickoff.md).
