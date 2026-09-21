# bodkin — the evolution

The `evolve` branch turns loupe into **bodkin**: a frontend rewrite, a rebrand, and a modernized distribution + docs setup. This folder is the durable record of that initiative.

## What's changing (and why)

- **Name:** loupe → **bodkin** — "loupe" is badly collided (npm, an active competitor, GNOME's image viewer). See [ADR 0004](../adr/0004-rename-loupe-to-bodkin.md).
- **Stack:** drop buildless; **Svelte 5 + Vite + Tailwind v4 + shadcn-svelte**, keeping **Bun** as the runtime + binary compiler. See [ADR 0005](../adr/0005-svelte-vite-drop-buildless.md).
- **Distribution:** install-script + prebuilt binaries on GitHub Releases; self-contained MCPB; package managers. See [ADR 0006](../adr/0006-distribution-binaries-install-script.md).
- **Brand:** dark-first, single indigo accent ("D5"). See [design.md](design.md).
- **Docs:** GitHub Pages → **Astro Starlight** on Cloudflare. **Demos:** **Remotion**. (In [plan.md](plan.md).)

## Documents

- [plan.md](plan.md) — phased implementation plan (incl. the cleanup workstream).
- [design.md](design.md) — brand & design system (D5 palette tokens, type, motion, craft floor).
- ADRs: [0004 rename](../adr/0004-rename-loupe-to-bodkin.md) · [0005 stack](../adr/0005-svelte-vite-drop-buildless.md) · [0006 distribution](../adr/0006-distribution-binaries-install-script.md).

## Preserved

The server (`Bun.serve` router/handlers, git/diff/review-record core, stdio MCP mode) and the `src/types.ts` contract are kept; this is primarily a client + tooling + brand + docs change.

## Open items before locking

- Confirm `bodkin.sh` at a registrar and run a software trademark sweep for "Bodkin" (fallback: `quoin`).
- Implementation runs per-phase via Claude ultracode workflows.
