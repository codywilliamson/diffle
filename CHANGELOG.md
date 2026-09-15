# Changelog

All notable changes to loupe are documented here. This project follows [semantic versioning](https://semver.org).

## [Unreleased]

### Added
- **Motion layer** — transitions.dev recipes across the review desk, timed from one motion-token scale in `motion.css`: modals and popovers scale and fade open and close faster than they open on every path, tooltips wait an intent delay, the open-comment badge pops and its digits re-enter on change, labels swap in place (Copy → Copied, Ready → Feedback sent), comment editors, saved cards and reply threads reveal with a cross-blur, a failed send shakes the composer, the sync notice grows in like a toast, tree folders expand as accordions with flipping chevrons, the viewed checkbox draws its check, the theme toggle cross-fades sun and moon, the loading label shimmers, and the mobile file drawer slides in. Everything honors reduced motion.
- **Session registry and cleanup** — every running Loupe server is recorded under the data directory, `loupe sessions` lists live and stale ones with their review status, `loupe cleanup` removes stale entries and stops finished servers after confirmation, the MCP server stops everything it launched on exit, and `start_review` reports stale sessions so agents can suggest cleanup.

### Fixed
- **Markdown preview** — rendered `.md` files had no padding, headings at body size, and broken repo-relative images. The preview now has a readable measure and heading scale, bordered code and tables, images served through `GET /api/raw`, external links that open in a new tab, and a skeleton loader that cross-fades into the content.
- **Completion-hook review ownership** — agent hooks now deduplicate only the review belonging to the same agent chat, so a review in one chat no longer blocks a new chat using the same repository; human-originated and legacy reviews remain unclaimed until explicitly handed off.

## [0.14.0] — 2026-09-04

### Changed
- **Review header regrouped** — file counts join the orientation side in a tonal wash, the review trigger and a neutral Preview button share one segment, view tools and utilities sit in washes instead of behind dividers, and phones get a single overflow menu so nothing scrolls off-screen.

### Fixed
- **Terminal reviews drop the open-count badge** — approved and cancelled reviews no longer show a red unresolved count beside their pill.
- **Cancel asks first** — cancelling a review with open comments or a drafted summary now confirms, matching Approve.
- **Count badge contrast** — the open-count digit clears AA in light mode.

## [0.13.1] — 2026-09-02

### Fixed
- **Summary-only feedback** — a reviewer summary with no comments can now be returned: the button enables, the record stores the summary as feedback, and the compiled Markdown carries a Reviewer summary section.

## [0.13.0] — 2026-09-01

### Added
- **Loupe proof-desk identity** — a custom split-aperture mark, editorial site typography, and one shared paper-and-ink design system now span the review app, overview, docs, and favicon.
- **Mobile file drawer** — narrow screens keep file filtering, viewed progress, directory navigation, and 44px touch targets instead of dropping the navigator.
- **Live review sync** — the review page polls its Review Record while visible, so agent replies, addressed marks, and rereview requests appear without a reload, with a quiet notice bar and a one-click diff refresh.
- **Reopen after approval** — an agent calling `request_rereview` on an approved review reopens it for another pass instead of failing, keeping the full activity trail in one record.
- **Threaded replies** — reviewers can answer directly under a comment; agent and reviewer replies render as one authored, timestamped thread and flow into the compiled Markdown feedback.

### Changed
- **Two complete appearance modes** — the old four-theme cycle is replaced by focused light-paper and dark-charcoal modes with OS fallback, persisted preference, accessible diff semantics, and legacy-setting migration.
- **Review workspace hierarchy** — repository context, view tools, feedback actions, inline comments, dialogs, focus states, and responsive behavior now use the proof-desk component language.
- **Overview and documentation site** — both static pages now demonstrate the real review loop in the same brand system, with refreshed screenshots, walkthrough media, and keyboard-accessible image inspection.
- **Interactive homepage review** — the homepage now demonstrates inspect, mark, return, and rereview as one accessible stateful artifact, with a dedicated mobile composition and shell-neutral installation copy.
- **Review outcome menu** — the review panel is a real popover that closes on Escape, click-outside, and after an action, returns focus to its trigger, and shows the review state and open-comment count as legible pills in the top bar.

### Fixed
- **Walkthrough capture selector** — the reproducible media script follows the current reviewer-summary field again.
- **Single-sided files stay unified** — added and deleted files never render side-by-side and hide the per-file split toggle, since only one side has content.
- **Approving with unresolved comments** — the acknowledgement flag is now sent as a boolean, so approving over open comments no longer fails.
- **Comment saves keep agent replies** — saving reviewer comments merges by id and preserves replies and addressed marks the agent wrote in the meantime.
- **Narrow top bar** — action buttons no longer shrink below their labels on phones; the strip scrolls instead.

## [0.12.0] — 2026-08-29

### Added
- **Durable Review Records** — reviews now live under the user's Loupe data directory with summaries, agent replies, addressed/resolved comments, explicit outcomes, and retained history.
- **Local MCP server** — six structured review tools power Codex and Claude Code integrations while keeping approval and resolution reviewer-owned.
- **Native and MCPB packaging** — Loupe compiles to a local executable and stages a validated platform bundle with its browser assets.
- **Manual feedback formats** — copy unresolved feedback as structured JSON or context-rich Markdown.
- **0.12 What's New** — the in-app release summary now introduces the agent loop, durable history, and optional completion hooks.
- **Agent walkthrough** — a reproducible Playwright capture uses a real Claude Code edit to demonstrate comment, feedback return, agent reply, rereview, resolution, and approval in WebM, MP4, and GIF formats.

### Changed
- **Loupe-native product language** — refreshed product copy and internal design tokens around Loupe's own review model.
- **Legacy `.review` handling** — existing files are never migrated automatically; reviewers choose import, confirmed removal, or ignore.
- **Release-quality review workflow** — review state uses plain-language labels, agent/manual next-step guidance sits beside the outcome controls, and feedback actions lead the toolbar.
- **Responsive review workspace** — mobile uses the full viewport for the diff, moves controls into a two-row toolbar, and presents review actions in a fitted sheet.
- **Legacy setting removed** — the obsolete `.review` visibility gear, persisted option, and supporting code are gone; legacy files stay hidden until explicitly imported.

### Fixed
- **Current-change agent reviews** — `HEAD` now resolves to the working tree, the MCP contract explicitly directs agents to `working`, and empty comparisons fail with an actionable error instead of opening a blank review.
- **Rereview summary authorship** — agent updates are stored on the agent's activity entry and shown read-only, while each reviewer outcome starts with a blank reviewer-owned summary field.
- **Codex plugin installation** — marketplace plugins now live at the repository root where Codex resolves them, and the documented repository-root install command works on a clean machine.

## [0.11.0] — 2026-08-17

### Added
- **Settings menu** — a gear in the top bar, holding one setting: **Review the `.review` file**. Settings live in `~/.loupe/state.json`, so they stick across launches even though each one picks a fresh port.

### Changed
- **`.review` stays out of the review** — it was only filtered from the untracked listing in working-tree mode, so a `.review` committed to the repo before loupe ever ran showed up as a reviewable file in branch, range, staged and browse listings. One filter now covers every mode. Turn the new setting on to review it like any other file.
- **`.review` is excluded via `.git/info/exclude`, not `.gitignore`** — `.gitignore` is tracked, so appending to it created a working-tree change that surfaced in the very review you were running. The exclude file is per-clone and never committed, and loupe writes it whether or not a `.gitignore` exists (it skips the write entirely when `.gitignore` already covers `.review`). Existing `.gitignore` entries are left alone.

## [0.10.3] — 2026-08-06

### Fixed
- **Browse-mode comments sit under the code again** — browse hides the old-line-number column, which dropped a `<td>` from every row while the comment row still spanned four columns. The comment box landed in a phantom column to the right of the code. The row and its comment row now derive their column count from the same place.

## [0.10.2] — 2026-08-06

### Fixed
- **`loupe browse` no longer dies on deleted files** — `git ls-files` reads the index, so it still lists tracked files that have been deleted from the working tree; reading the first one threw `ENOENT` and took the whole browse down. Deleted files are now dropped from the scan, and any other unreadable path (broken symlink, permissions) is skipped instead of aborting it.

## [0.10.1] — 2026-08-04

### Fixed
- **Fresh long lines can always scroll in side-by-side view** — re-running a diff now remeasures each changed pane even when the file path is unchanged, so a newly introduced long line gets the correct independent horizontal scrollbar.
- **Remote-only branches resolve automatically** — when a ref is not available locally, loupe now tries the matching `origin/<ref>` for both branch and range reviews.

## [0.10.0] — 2026-07-05

Performance overhaul for large diffs and large codebases. Baseline: a 150-file / 40k-line diff froze the tab for minutes and shipped 11 MB of JSON. Now it paints in ~3 seconds, stays smooth, and ships ~1 MB.

### Added
- **Giant-file guard** — files over 2,000 diff lines start collapsed behind a "Load diff (N lines)" note, so one monster lockfile can't stall the whole review. One click loads it.

### Changed
- **Lazy-mounted file bodies** — file sections render as height-preserving placeholders until you scroll near them (with a generous lookahead), then mount for real and unmount again when far away. The DOM stays small no matter how big the diff; open comment editors pin their section so drafts survive scrolling away and back.
- **Isolated re-renders** — commenting, drag-selecting, and selecting files now re-render only the file section you're touching instead of every file in the diff; drag-select is also frame-throttled. Large diffs no longer stutter while you work.
- **Gzipped responses** — the server now gzips API and static responses (~10× smaller diff payloads on the wire).
- **Faster startup** — the pinned CDN modules are preconnected and module-preloaded so the first paint isn't gated on a discovery waterfall.

## [0.9.1] — 2026-06-24

### Fixed
- **"What's new" modal no longer reappears every launch** — the dismissed version was remembered in `localStorage`, but loupe serves on a random port each run, so every launch was a fresh origin with no memory. The seen version now persists per-user in `~/.loupe/state.json`, so once you've dismissed it, it stays dismissed across repos and launches.
- **Couldn't drag the resizers** — because the what's-new modal popped on every launch, its full-screen backdrop quietly intercepted the very first resize drag (sidebar and side-by-side panes). With the modal fixed, both resizers grab as expected.

### Changed
- **Restyled the "what's new" modal** — it no longer borrows the wide compile-modal frame; it's a compact 460px card with a sparkles badge, version/date subtitle, and accent-marked highlights.

## [0.9.0] — 2026-06-24

### Added
- **Codebase browse mode** — `loupe browse [path]` opens the whole tracked codebase (optionally scoped to a subtree) in the same review UI, so you can read every file and leave inline questions/notes, then **Compile Review Prompt** to feed an LLM for onboarding or learning. Comments share the existing `.review` store.
- **"What's new" modal** — on the first run of a new version, loupe pops a curated highlights modal; reopen it anytime from the top-bar sparkles button or the `n` shortcut.
- **Independent side-by-side scrolling** — each side-by-side pane now has its own slim horizontal scrollbar (drag it, or **Shift**+scroll over the pane), so a long line scrolls that pane on its own without shoving the other. Fixes long lines overlapping across panes.
- **Word-wrap toggle** — a top-bar button (and the `w` shortcut) turns line wrapping on/off in both unified and side-by-side; off by default. Applies in browse mode too.
- **Comment either pane in side-by-side** — unchanged lines can now be commented on the left (old) pane too, not just the right; the comment remembers its side.

## [0.8.1] — 2026-06-23

### Fixed
- **Top-bar layout at narrow viewports** — left side now shrinks and truncates the ref label instead of colliding with the right side; file count and delta hidden below 640px (visible in the file tree anyway)
- **Code cells no longer wrap** — diff lines scroll horizontally instead of reflowing onto multiple rows
- **"Compile Review Prompt" button stays on one line** — no longer wraps at small widths

### Added
- **Multiline comment gestures in the shortcuts help** — drag the gutter or shift-click to select a range, now documented in the `?` overlay

## [0.8.0] — 2026-06-16

### Added
- **Orphaned-comment cleanup** — when the code moves on and a comment's line or file leaves the current diff, the comment used to disappear from the view while still bloating the compiled prompt. Such orphaned comments are now gathered in the *Compile Review Prompt* dialog under **From earlier reviews**, each with resolve and delete, so every saved comment stays reachable

### Fixed
- **Stale comments no longer leak into the compiled prompt** — comments whose anchor is absent from the current diff are excluded (like resolved ones), so prompts only contain notes about code you're actually reviewing

## [0.7.0] — 2026-06-16

### Added
- **Resolve comments** — mark a comment resolved instead of deleting it; it stays in the thread (dimmed, with a badge) but drops out of the compiled prompt and the open-comment counts, and reopens with one click
- **Markdown preview in the compile dialog** — *Compile Review Prompt* now renders as formatted markdown by default, with a toggle to the raw source; the copy button reads **Copy as Markdown**
- **Loading screen** — an animated indicator while the initial diff loads, instead of a bare "Loading…" line

### Changed
- **Range comments from the line numbers** — drag across the line-number gutter (or shift-click a second line) to select a range; the hover bubble still works too
- **Markdown opens as a diff** — `.md` files now show their changes by default so edits are obvious; the per-file Preview toggle still renders them
- **`.review` is created lazily** — only your first comment writes the file and appends it to `.gitignore`; just browsing or marking files viewed no longer touches your repo
- Site redesigned as a self-demonstrating review session — the landing page is a diff under review (hunk pills, struck-through deletions, comment-card copy), with a mobile-first layout, active-section highlighting, and a scrollable nav on the docs page

### Performance
- Faster initial load on large diffs: the launch-time diff is served for the first request instead of re-running `git diff`, and syntax highlighting is computed once per hunk (no per-line language auto-detection)

## [0.6.0] — 2026-06-09

### Added
- **Claude themes** — the theme button now cycles light → dark → claude → claude dark; the new pair are warm Anthropic-inspired palettes (ivory paper / soft charcoal, terracotta accents)
- **Word-level diff highlights** — the changed segment inside a modified line pair is tinted in both unified and side-by-side views
- **Keyboard shortcuts** — `j`/`k` walk files, `v` toggles viewed, `s` split, `o` single-file view, `t` theme, `r` refresh, `c` compile, `?` opens a shortcut overlay, `Esc` closes dialogs
- **Comment tags** — label a comment `nit`, `issue`, `question`, or `praise`; pills in the UI, `**[tag]**` prefixes in the compiled prompt
- File-tree **filter box** and a **viewed-progress bar** in the sidebar
- CLI flags: `--port <n>`, `--no-open`, `--version`, `--help` — plus a styled launch banner
- **Landing + docs site** on GitHub Pages ([codywilliamson.github.io/loupe](https://codywilliamson.github.io/loupe/)), deployed by a workflow

### Changed
- Selecting a file in the tree now tracks the current file in all-files view too (powers `j`/`k`/`v`)

## [0.5.0] — 2026-06-04

### Added
- Untracked files now appear in the working-tree view, rendered as additions you can comment on — previously `git diff` hid new, un-added files
- Diff-context header in the top bar: the repo, the diff mode (working tree / staged / branch / range), and the source → target refs, so you always know what you're reviewing
- Comment on **both sides** in side-by-side view, and on removed (old) lines in unified view too — comments remember their side and the exported prompt labels them `Old line N`
- Styled, state-aware hover tooltips on the top-bar icon buttons

### Fixed
- Multi-line comment selection (drag or shift-click) works again when a file has scrolled under the sticky header
- The global side-by-side toggle no longer gets stuck — switching all files is reliable in both directions
- The inline comment box now opens under the side you clicked instead of always the left
- loupe no longer lists its own `.review` file as a changed file
- Side-by-side comments no longer store a broken line reference

## [0.4.0] — 2026-06-03

### Added
- Global view toggles in the top bar: switch **all** files between unified and side-by-side at once, and a **single-file view** that shows one file at a time (click a file in the tree to swap). Both choices persist across reloads, like dark mode
- Sticky file headers: the file name stays pinned at the top while you scroll through its diff
- Update-available badge: a pulsing dot appears next to the wordmark when a newer loupe release exists on origin; click it for the `git pull` command to update
- Diff refresh: a top-bar button re-runs `git diff` in place (and a browser reload now picks up repo changes too), so you can review continuously while an agent edits

### Changed
- Multi-line comments: click-and-drag across lines to highlight a range, then comment — shift-click a second line still extends a range too

## [0.3.0] — 2026-06-02

### Added
- Dark mode with a top-bar toggle (persisted; follows the OS preference by default)
- Markdown files render as a preview by default, with a toggle to the raw diff
- Multiline (range) comments — shift-click a second line to extend the selection; the compiled prompt renders `Lines A–B`
- Resizable sidebar and resizable side-by-side panes (draggable dividers)
- PowerShell syntax highlighting (`.ps1` / `.psm1` / `.psd1`)

### Fixed
- Side-by-side view no longer collapses the right-hand pane
- The inline-comment bubble no longer shifts the line on hover

## [0.2.1] — 2026-06-02

### Documentation
- Document the Windows PowerShell `$PROFILE` install for the global `loupe` command

## [0.2.0] — 2026-06-02

### Added
- Installable `loupe` command — `bin` entry + `#!/usr/bin/env bun` shebang, so `bun link` (macOS/Linux) or a shell function (Windows) runs loupe from any git repo
- Launch banner now summarizes the ref and changed-file count

## [0.1.0] — 2026-06-02

### Added
- Unified and side-by-side git diff viewer with a focused review UI
- Inline line-level and file-level comments, persisted to `.review`
- Viewed-file tracking in the sidebar
- **Compile Review Prompt** — export all comments as a structured LLM prompt
- CLI modes: working tree, staged, branch, and commit-range diffs
