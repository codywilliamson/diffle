---
title: Reviewing changes
description: Open a diff, a branch, a range or one commit in the browser, pick a view, and work through the files.
sidebar:
  order: 1
---

Run `nittle` with a ref to read that diff in the browser, one PR-style page per review.

## Pick what to review

Run it from inside the repository. Each form maps to one `git diff`:

```sh
nittle                # working tree vs HEAD, untracked files included
nittle staged         # staged changes only
nittle main           # what this branch added since main (main...HEAD)
nittle v1.2.0..HEAD   # a commit range
nittle browse src/    # the whole codebase under src/, no diff
```

A branch review compares commits only (`main...HEAD`), so uncommitted edits don't show up in it. Run plain `nittle` for those.

A ref git doesn't know stops before anything opens:

```
$ nittle mian
[nittle] unknown ref: mian
```

The [CLI reference](/reference/cli/) lists every flag, such as `--port` and `--no-open`.

## Review one commit

`nittle show` reviews HEAD against its first parent. Pass a rev for any other commit:

```sh
nittle show
nittle show HEAD~2
nittle show a1b2c3d --no-open
```

The page opens with a commit header: the short hash, the subject, the body, the author and the date. Click the hash to copy the full one. A merge commit is shown against its first parent, and the header says so. A root commit is compared with the empty tree.

![The commit header above the diff: short hash, subject, body, author and date](/media/gallery/show-commit.png)

The review is pinned to the full hash, so reopening it later shows the same diff after HEAD moves. That holds as long as the commit exists. A rebase followed by `git gc` removes it.

```
$ nittle show nosuchrev
[nittle] unknown commit: nosuchrev
```

## Move through the files

The sidebar lists every changed file. Type in the Filter files… box to narrow it by path. The Tree / Review order toggle under it (or `m`) switches between the folder tree and the review order described in the [review scorecard](/guides/review-scorecard/#review-order) guide.

Every changed file shows on one scrolling page by default. Press `o` to switch to single-file view, which shows only the file you pick in the sidebar. Press `o` again to go back.

Each tree row has a check mark on its right. Click it, or press `v` on the cursor's file, to mark that file viewed. The counter above the tree shows how many you've cleared, for example `3/12 viewed`.

To review without the mouse, see [Keyboard review](/guides/keyboard-review/).

## Choose a view

Press `s` to switch between unified (one column) and side-by-side (old left, new right). Added and deleted files always render unified, since they have no second side. Browse mode is always unified.

A file header carries its own Unified / Side-by-side button that overrides the global view for that file only. Pressing `s` again clears every per-file override.

Each side of a side-by-side file scrolls horizontally on its own. Use a trackpad swipe or `Shift` + wheel over a pane. Drag the divider to resize the panes. You can also `Tab` to it and use the arrow keys (`Shift` for bigger steps), `Home` and `End`. Double-click it or press `Enter` to reset to equal widths.

Press `w` to wrap long lines. Rows on both sides stay aligned when one side wraps more than the other.

Press `t` to switch between light and dark themes.

:::note
View choices (theme, split, wrap, divider width, file order) live in browser storage for the page's origin. nittle picks a random port on each launch, so they reset between launches. Pass a fixed port, such as `nittle -p 4400`, to keep them.
:::

Code is highlighted with VS Code's TextMate grammars, including Svelte, Vue and Astro files and named files like `Dockerfile`. nittle reads the surrounding file to work out where a hunk starts, so a change halfway down a `<style>` block or a long comment still highlights correctly.

## Files that start collapsed or hidden

- Deleted files start collapsed. Click the chevron in the header to read them.
- Lockfiles and generated files collapse with a "Lockfile — collapsed" or "Generated file — collapsed" note and an Expand button. The [review scorecard](/guides/review-scorecard/#noise) guide lists what counts.
- A file whose diff has more than 2000 lines shows "Large diff — hidden to keep things fast." Click Load diff to render it.
- Binary files show "Binary file — no textual diff."

`zo` and `zc` open and close the cursor's file from the keyboard, and `zO` and `zC` do every file.

## Read markdown rendered

A changed markdown file has a Diff / Preview button in its header. Preview renders the new version of the file, with relative images loaded from the repository. The HTML is sanitized, so scripts and event handlers in a reviewed `.md` never run. Deleted markdown files have no preview.

## Spot whitespace and moved code

A hunk that only changes whitespace is dimmed, and its header reads `whitespace only`.

When a run of three or more lines is deleted in one place and added in another, both ends get a marker, such as `moved from Store.cs:12` on the new lines and `moved to Store.cs:40` on the old ones. A block that was moved and then changed reads `moved from Store.cs:12 (edited)`. Click the marker to jump to the other file.

![A collapsed lockfile, a dimmed whitespace-only hunk and a moved-code marker](/media/gallery/noise-moved.png)

<video src="/media/takes/modes.mp4" poster="/media/takes/modes.jpg" autoplay muted loop playsinline width="1280" height="800"></video>

## Refresh after the code changes

nittle re-runs `git diff` when you press `r` or click Re-run the diff (the circular arrow) in the top bar. The review, your comments and the cursor carry over.

A comment whose line or file leaves the diff moves to a From earlier reviews section at the top of the page, and the feedback leaves it out. See [Stale comments](/guides/inline-comments/#stale-comments).

## When the server stops

The browser page needs the nittle process that served it. If that process exits, a red banner says "The nittle server is gone." Saving comments and sending feedback are off until it's back. The banner shows the command to restart it, with the review id and the port filled in:

```sh
nittle --review-id <id> --port 4400
```

Run it from the same repository and the page reconnects by itself.

If a different review is now running on that port, the banner reads "A different review is running on this port." instead. Writes stay off on that page, and Reload to open it loads the other review.

## Update from the top bar

When a newer release exists, an Update badge with the version appears in the top bar. It checks every 10 minutes (never, with `NITTLE_NO_UPDATE_CHECK` set) and links to the release notes. Run `nittle update` to install it. See [Installation](/getting-started/installation/).

## Related pages

- Learn the keys in [Keyboard review](/guides/keyboard-review/), or look one up in [Keyboard shortcuts](/reference/keyboard-shortcuts/).
- Leave feedback with [Inline comments](/guides/inline-comments/).
- Triage a large change with the [Review scorecard](/guides/review-scorecard/).
