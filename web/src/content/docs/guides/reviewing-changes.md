---
title: Reviewing changes
description: Read a git diff in the browser, filter files, switch views, and keep track of what you've reviewed.
sidebar:
  order: 1
---

diffle serves your working diff as a browser UI. Point it at a ref and it runs `git diff`, parses the result, and opens a review pane.

```sh
diffle HEAD~1
```

See the [CLI reference](/reference/cli/) for the full ref syntax.

## The file tree

Every changed file appears in the sidebar tree. Click a file to jump to it. Filter the tree by typing in the filter box to narrow the list to matching paths — useful in large diffs. Press `m` (or use the sidebar toggle) to switch to **Review order**, which groups files by project and puts each source file before its test. See the [review scorecard](/guides/review-scorecard/).

## Unified vs side-by-side

Toggle between **unified** (one column, `+`/`-` markers) and **side-by-side** (old on the left, new on the right) with the `s` shortcut. Added and deleted files always render **unified** — there is no counterpart column to show.

Each side scrolls horizontally on its own. Hover the old or new pane and use a horizontal trackpad swipe or `Shift` + wheel to inspect a long line. Line numbers and comment controls stay visible; vertical scrolling keeps both sides together. At a horizontal edge, `Shift` + wheel returns to vertical scrolling.

Drag the divider to give either side more room. You can also focus it with `Tab` and use the left/right arrow keys (`Shift` for larger steps), or `Home` / `End` to reach the limits. Double-click the divider or press `Enter` to restore equal widths. The width choice is remembered across files and reloads.

Turn on **line wrapping** to fold long lines into each pane's width. Corresponding lines stay aligned even when one side wraps more, or a comment thread expands. Inline and range comments remain attached to their own side.

![A side-by-side diff: the old file on the left, the new file on the right, with an inline comment thread](/media/side-by-side.png)

## Syntax highlighting

Code is highlighted with the same TextMate grammars VS Code uses, so most languages are covered, including Svelte, Vue, and Astro components, and files recognized by name such as `Dockerfile` and `Makefile`. diffle reads the surrounding file to work out where each hunk starts, so a change halfway down a `<script>` or `<style>` block, or inside a long comment, still highlights correctly. Grammars load only for the languages in your diff.

## Single-file vs all-files view

By default diffle shows one file at a time. Switch to **all-files** view with `o` to scroll the entire diff continuously. Use single-file view to focus; use all-files to skim the whole change.

## Marking files viewed

Mark the current file **viewed** with `v` (or the checkbox in its header). The **viewed progress** indicator tracks how many files you've cleared, so you can work through a large diff without losing your place.

## Live refresh

diffle re-runs `git diff` on demand — press `r` (or hit **Re-run**) after you change the code to pull the latest diff into the same session. Your [inline comments](/guides/inline-comments/) are preserved across re-runs.

## Large files and markdown

Files above the size threshold are gated behind a **load** prompt so a huge diff doesn't stall the pane — click to load an individual file when you want it.

Markdown files show their diff like any other file, plus a per-file **Preview** toggle that renders the markdown so you can see the formatted result alongside the changes.

## Keyboard shortcuts

| key | action |
| --- | --- |
| `j` / `k` | next / previous file |
| `v` | toggle viewed on the current file |
| `s` | unified ↔ side-by-side |
| `w` | wrap long lines |
| `o` | single-file ↔ all-files view |
| `g` | open the review scorecard |
| `m` | file list: tree ↔ review order |
| `t` | toggle light / dark |
| `r` | re-run the diff |
| `c` | preview review feedback |
| `?` | shortcut overlay |
| `Ctrl`/`⌘` + `Enter` | save the open comment |
| `Esc` | close dialogs, cancel an open comment |

## Next steps

- Triage a large change with the [Review scorecard](/guides/review-scorecard/).
- Leave feedback on the diff with [Inline comments](/guides/inline-comments/).
- Return your comments to an agent with [Agent feedback](/guides/agent-feedback/).
