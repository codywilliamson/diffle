# diffle — brand & design system

> Supersedes the root `DESIGN.md` (the retired "proof desk" system). That palette was retired because its warm ivory + terracotta read as Claude/Anthropic's own brand. This document is the source of truth for the new look; the root `DESIGN.md` is rewritten from this at build time. Live mockups: the design-directions canvas (app + landing + docs, all in D5).

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

**One-accent rule:** `--accent` carries every action (primary button, active file, the mark, links); `--focus` (a lighter tint of the same hue) carries keyboard focus and comment borders so focus stays legible without a second brand color. A light theme is TODO — map the same semantic roles to light values; never introduce a third hue.

## Typography (kept from loupe)

- **Display / reading:** Source Serif 4 — the editorial voice; headings and app reading moments. Tracking floor `-0.04em`.
- **UI / body:** DM Sans — controls, dense UI, metadata.
- **Code / labels:** IBM Plex Mono — paths, hunks, shortcuts, counts, commands.

Serif explains the review, mono identifies its coordinates, sans carries the controls.

## Shape & depth

- App controls: 7px radius default. Marketing site: squared / "galley" panels (color and rule do the work).
- Flat-by-default: borders and tonal surfaces carry structure. Shadows only for transient overlays, and only with a real offset **and** soft blur (no zero-offset colored halos).

## Motion stack

Native-first, one heavyweight for the hard part (see [ADR notes in plan](plan.md)):

- **`svelte/motion` springs/tweens** — state-driven motion (drag, hover, collapse, optimistic-save nudges).
- **`svelte/transition` + `animate:flip`** — enter/exit, staggered diff-line reveals, FLIP reordering of files/comments.
- **GSAP** (now free) — orchestration only: sequenced timelines, SplitText, ScrollTrigger.
- **NumberFlow** — animated counts (diff ±, unresolved-comment badges).
- **View Transitions API** — theme swap, file→diff morph (feature-detected).
- **Reduced motion must be gated in code** — Svelte transitions run on WAAPI, so a CSS media query alone won't disable them.

## Craft floor (enforced, from the impeccable pass)

- No hero kicker/eyebrow; the heading carries itself.
- No `01/02/03` section numbers unless the sequence is information.
- No same-size icon+heading+text card triptych as page structure; prefer editorial, hairline-divided composition.
- Callouts/asides use a 1px full border + tinted fill + icon, never a thick colored left-bar.
- Theme the browser surfaces: `::selection`, caret, scrollbars, focus rings — all from the palette.
- Contrast: body/placeholder ≥4.5:1, large ≥3:1; secondary text tinted from the hue.

## Mark

Current mark is loupe's split-aperture lens, recolored to indigo. TODO: evolve the mark to suit diffle — a split-aperture or diff/merge motif.
