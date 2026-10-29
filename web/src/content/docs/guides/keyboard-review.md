---
title: Keyboard review
description: Review a whole diff without the mouse, from the first hunk to the last comment.
sidebar:
  order: 2
---

Read, comment on and finish a diff from the keyboard. The keys follow vim, so `j` moves down a line and `10j` moves ten. Every binding is in [Keyboard shortcuts](/reference/keyboard-shortcuts/), and `?` shows the same list in the app.

<video src="/media/takes/keyboard.mp4" poster="/media/takes/keyboard.jpg" autoplay muted loop playsinline width="1280" height="800"></video>

## Put the cursor on a line

Open a review and press `j`. A highlighted row appears in the file you're on. That row is the cursor, and every key below acts on it.

`j` and `k` move one line. Type a count first to move further: `5j`, `20k`. The count waits for the next key, and `Esc` drops it.

![The line cursor resting on a changed line, with the row highlighted](/media/gallery/keyboard-cursor.png)

Keys are ignored while focus is in a field such as the filter box or a comment. Closing a comment box hands the keys back to the diff. From the filter box, click the diff.

## Jump through the change

Most of a review is moving between the places that changed:

- `]` and `[` go to the next and previous hunk.
- `J` and `K` go to the next and previous file. In review order they follow that order.
- `gg` goes to the first line of the file and `G` to the last. `42G` goes to line 42 of the new file, or the nearest line the diff shows.
- `Ctrl+d` and `Ctrl+u` move half a page.
- In a side-by-side file, `h` puts the cursor on the old side and `l` on the new side.

Collapsed files, binary files and large files you haven't loaded have no lines to rest on. `j` and `k` skip them, and `J` and `K` stop on their header. `zo` opens the cursor's file, `zc` closes it, and `zO` and `zC` do every file.

Hunk, file, top and bottom moves are jumps, and so are search hits and the file picker. `Ctrl+o` steps back to where you were before the last jump, and `Ctrl+i` steps forward again. The history holds 100 jumps.

## Get to a file by name

`Ctrl+p` (`Cmd+p` on macOS) opens **Go to a changed file…**. Type part of a path, use the arrow keys, and press `Enter`.

`gf` follows a path written on the cursor line, such as an import of `./store` or a reference like `src/api.ts:42`. It only goes to files in the diff. When the path fits more than one changed file, it opens the picker with the path filled in. With no changed path on the line, it says "No changed file path on this line."

To find text instead of a file, see [Searching](/guides/searching/).

## Comment on what you read

With the cursor on a line, press `c`. The comment box opens under it. Type, then press `Ctrl+Enter` (`Cmd+Enter` on macOS) to save. The cursor goes back to the line you left.

For a range, press `V` on the first line. `j`, `k`, `]` and `[` extend the range, and `c` opens the box for the whole selection. `Esc` cancels the range. `gv` brings the last range back if you need it again.

`C` comments on the cursor's whole file instead of a line.

`Esc` closes the comment box and keeps what you typed, so `c` on the same line brings it back. The **Cancel** button throws it away. See [Inline comments](/guides/inline-comments/#drafts) for how drafts are kept.

## Work on comments already there

When the cursor's line has a comment, these keys act on it:

- `e` edits it. A resolved comment has to be reopened first.
- `R` resolves it, or reopens it when it's resolved.
- `dd` deletes it. An Undo toast stays up for 8 seconds, and `u` undoes the delete while it shows.
- `yy` copies the comment text. On a line with no comment, it copies the line.
- `}` and `{` step between comments when a line has more than one.

On a line with no comment, these keys say "No comment on this line." and do nothing. Holding a key down repeats motions such as `j` but never `dd` or other changes, so a held key can't delete a row of comments.

## Finish the file and the review

Press `v` to mark the cursor's file viewed, then `J` to move on. When every file is done:

- `gc` opens the [review scorecard](/guides/review-scorecard/) if you want a second look at the risky spots.
- `P` previews the feedback exactly as the agent will get it.

Return or approve the review from the review panel. See [Agent feedback](/guides/agent-feedback/).

## Read code around the change

With a language server installed, `gd` goes to the definition of the word on the cursor line, `gh` shows its docs and `gA` lists references. `Ctrl+o` comes back. See [Code navigation](/guides/code-navigation/).

## Cancel anything with Esc

`Esc` peels off one layer per press: a half-typed count or chord, then an open dialog, the file picker, a code navigation popup, the search panels, and last a visual range. A two-key chord such as `gg` is dropped if the second key doesn't come within 1 second.
