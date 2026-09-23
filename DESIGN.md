# diffle — brand & design system

> This is the canonical source of truth for diffle's look — color, typography, and craft. The client's D5 variables in `client/src/styles/tokens.css` implement it, and Tailwind/shadcn tokens alias those rather than creating a parallel palette. The old warm "proof desk" palette that used to live here was retired because its warm ivory + terracotta read as Claude/Anthropic's own brand; do not reintroduce it. Live mockups: the design-directions canvas (app + landing + docs, all in D5).

## North star

diffle keeps loupe's thesis — **close, exact inspection of a change before it ships**, the way a printer proofs a page — but in a new, **dark-first** visual world. The name is deliberately goofy — it's a diff tool, literally, called *diffle* — worn under a deadpan-serious backronym: the **Deterministic Inspection & Feedback Framework for Language-model Engineering**. Dark is the default because the audience lives in terminals and editors; a light theme is a secondary variant, not the primary.

## Palette — "D5 blended indigo" (dark, default)

Single indigo accent, deliberately away from Claude's warm palette. Diff washes stay green/red for legibility; secondary text is tinted from the base hue, never flat gray.

| Role | Token | Hex |
|---|---|---|
| Base / page | `--bg` | `#0B0E16` |
| Surface (panels, diff canvas) | `--surface` | `#141826` |
| Surface-2 (gutters, pills, index) | `--surface-2` | `#1B2133` |
| Border | `--border` | `#29304A` |
| Subtle divider | `--divider` | `#1C2233` |
| Text | `--text` | `#E4E7F0` |
| Muted text | `--muted` | `#8C93AB` |
| Dim (line numbers) | `--dim` | `#5C6480` |
| Accent — action | `--accent` | `#6F82F0` |
| Accent hover | `--accent-hover` | `#8496F4` |
| Focus / comment border | `--focus` | `#93A2F5` |
| Add — bg / gutter / text / inline | | `#14271F` / `#1E4234` / `#74DBA6` / `#2C6349` |
| Del — bg / gutter / text | | `#2A1A20` / `#46242C` / `#EF8E8E` |
| Modified badge — bg / text | | `#33301A` / `#E4C55E` |
| Renamed badge — bg / text | | `#26304A` / `#98A6F0` |

**One-accent rule:** `--accent` carries every action (primary button, active file, the mark, links); `--focus` (a lighter tint of the same hue) carries keyboard focus and comment borders so focus stays legible without a second brand color.

## Palette — D5 light

Light mode is part of existing loupe parity, so the rewrite must not invent it during component work. It uses the same semantic roles and indigo identity:

| Role | Token | Hex |
|---|---|---|
| Base / page | `--bg` | `#F6F7FC` |
| Surface (panels, diff canvas) | `--surface` | `#FFFFFF` |
| Surface-2 (gutters, pills, index) | `--surface-2` | `#ECEFFA` |
| Border | `--border` | `#CBD1E4` |
| Subtle divider | `--divider` | `#E0E4F0` |
| Text | `--text` | `#171B2C` |
| Muted text | `--muted` | `#5E667F` |
| Dim (line numbers) | `--dim` | `#626B85` |
| Accent — action / focus | `--accent`, `--focus` | `#4E63D9` |
| Accent hover | `--accent-hover` | `#4053C1` |
| Add — bg / gutter / text / inline | | `#E8F7EF` / `#CAEAD8` / `#1F6B45` / `#A9DABD` |
| Del — bg / gutter / text / inline | | `#FBEAEC` / `#F1CDD2` / `#9A3544` / `#E8B1BA` |
| Modified badge — bg / text | | `#F7F0CE` / `#6E5A13` |
| Renamed badge — bg / text | | `#E9EDFC` / `#4456B1` |

These semantic CSS variables are canonical. Tailwind v4 maps them through `@theme inline`; shadcn-svelte variables alias them rather than creating a parallel palette. Status colors remain reserved for diff/status meaning. There is no third theme.

## Typography (kept from loupe)

- **Display / reading:** Source Serif 4 — the editorial voice; headings and app reading moments. Tracking floor `-0.04em`.
- **UI / body:** DM Sans — controls, dense UI, metadata.
- **Code / labels:** IBM Plex Mono — paths, hunks, shortcuts, counts, commands.

Serif explains the review, mono identifies its coordinates, sans carries the controls.

## Shape & depth

- App controls: 7px radius default. Marketing site: squared / "galley" panels (color and rule do the work).
- Flat-by-default: borders and tonal surfaces carry structure. Shadows only for transient overlays, and only with a real offset **and** soft blur (no zero-offset colored halos).

## Motion stack

Native-first, one heavyweight for the hard part (see [ADR notes in plan](docs/diffle/plan.md)):

- **`svelte/motion` springs/tweens** — state-driven motion (drag, hover, collapse, optimistic-save nudges).
- **`svelte/transition` + `animate:flip`** — enter/exit, staggered diff-line reveals, FLIP reordering of files/comments.
- **GSAP** (now free) — orchestration only: sequenced timelines, SplitText, ScrollTrigger.
- **NumberFlow** — animated counts (diff ±, unresolved-comment badges).
- **View Transitions API** — theme swap and file→diff morph (feature-detected, with an immediate fallback).
- **Reduced motion must be gated in code** — Svelte transitions run on WAAPI, so a CSS media query alone won't disable them.

## Craft floor (enforced, from the impeccable pass)

- No hero kicker/eyebrow; the heading carries itself.
- No `01/02/03` section numbers unless the sequence is information.
- No same-size icon+heading+text card triptych as page structure; prefer editorial, hairline-divided composition.
- Callouts/asides use a 1px full border + tinted fill + icon, never a thick colored left-bar.
- Theme the browser surfaces: `::selection`, caret, scrollbars, focus rings — all from the palette.
- Contrast: body/placeholder ≥4.5:1, large ≥3:1; secondary text tinted from the hue.

## Mark

The **hunk** mark: a rounded code tile holding two muted context lines and one indigo band — the line under review. Frame and context lines take `currentColor`; the band is the only accent (`--accent`), per the one-accent rule.

- **Geometry (32×32):** frame `4,4 24×24 r6.5` stroked 2; context lines `8.5,9 11×2.75` and `8.5,20.25 7.5×2.75` at 55% opacity; band `7,13.75 18×4.5`. Every copy (`client/public/favicon.svg`, `Mark.svelte`, `web/src/components/Mark.astro`, `demos/src/components/Mark.tsx`) uses exactly this — change it everywhere or nowhere.
- **Favicon:** `client/public/favicon.svg` is the source; it switches light/dark ink via `prefers-color-scheme`. The docs build copies it (and `apple-touch-icon.png`) into `web/public/`.
- **App icon:** the frame becomes a filled `--surface` tile (`#141826`, hairline `--border`) — `mcpb/icon.png` (512, rounded) and `client/public/apple-touch-icon.png` (180, full-bleed; iOS masks it).
- **Motion:** context lines draw in from the left, then the band sweeps across — "a line gets picked out for review." One-shot entrance on the landing header, a loop as the app's loading state, spring-driven on the demo title cards. Reduced motion shows the static mark.
