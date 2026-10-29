---
title: Suggested changes
description: Propose the exact replacement lines in a comment, and give your agent a structured edit it can apply without guessing.
sidebar:
  order: 4
---

Write the replacement code into a line comment so the agent gets an exact edit instead of a description. A suggestion is a fenced block inside an ordinary comment, so it rides along with your note, your tag and the reply thread.

## Suggest a change from the comment box

1. Open a comment on a line or a range of changed lines, by clicking the line number or dragging across several (see [Inline comments](/guides/inline-comments/)).
2. Click Suggest change, or press `Ctrl`+`G` while the comment box has focus. This is `Ctrl` on macOS too.
3. nittle inserts a suggestion fence at the cursor, prefilled with the lines you're commenting on, and selects those lines. Type over them with the code you want.
4. Add any explanation above or below the fence, then save with `Ctrl`+`Enter`.

<video src="/media/takes/suggest.mp4" poster="/media/takes/suggest.jpg" autoplay muted loop playsinline width="1280" height="800" aria-label="Selecting two changed lines, pressing Ctrl+G to insert a prefilled suggestion fence, typing the replacement, and saving to a Suggested change diff on the comment card"></video>

For a comment on line 8 of `src/retry.ts`, the box ends up like this:

````md
Cap the backoff so attempt 5 doesn't sleep for 1.6s.

```suggestion
      await sleep(Math.min(100 * 2 ** attempt, 1000));
```
````

The saved comment shows each suggestion as a small diff titled Suggested change: the current lines with `−`, your replacement with `+`. Prose around the fence renders as normal markdown.

![A comment card with a sentence of explanation above a Suggested change block showing one removed line and one added line](/media/gallery/suggestion.png)

## Write the fence by hand

The fence is the one GitHub uses: three or more backticks followed by `suggestion`, the replacement lines, then a closing fence of at least the same length.

- An empty fence means delete the lines. The card says "These lines would be deleted."
- One comment can hold several fences. Each becomes its own suggestion for the same lines.
- If the replacement contains backticks, use a longer fence (four or more). The Suggest change button picks a safe length for you.
- Only a backtick fence counts. A `~~~suggestion` fence, or a suggestion fence quoted inside another code block, stays plain text.
- A fence with no closing line is treated as plain text from that point on.

## What the agent receives

Over MCP, `get_review` lists every suggestion in a `suggestions` array, one entry per fence:

```json
{
  "commentId": "c3",
  "path": "src/retry.ts",
  "side": "new",
  "startLine": 8,
  "endLine": 8,
  "original": [
    "      await sleep(100 * 2 ** attempt);"
  ],
  "suggested": [
    "      await sleep(Math.min(100 * 2 ** attempt, 1000));"
  ]
}
```

`original` and `suggested` are arrays of lines with indentation kept, and an empty `suggested` array means delete. The agent can apply it as a plain line replacement without parsing your comment.

In the compiled prompt (`nittle --wait`, Copy Markdown, the `P` preview), each fence expands in place into the lines it replaces and the lines to put there:

````md
**[issue]** Cap the backoff so attempt 5 doesn't sleep for 1.6s.


Suggested change to src/retry.ts, line 8:

ORIGINAL
```
      await sleep(100 * 2 ** attempt);
```

SUGGESTED
```
      await sleep(Math.min(100 * 2 ** attempt, 1000));
```
````

A delete reads `SUGGESTED (delete these lines)` over an empty block. The full prompt this came from is in [Agent feedback](/guides/agent-feedback/#what-the-agent-receives).

## Where suggestions don't work

The button only appears for comments on the new side of the diff. Comments on removed lines and file-level comments don't get it. A fence you type into a file-level comment by hand stays exactly as written in the card and the prompt, and isn't listed in `get_review`.

A range has to sit inside the diff with no gaps. If you select lines from two hunks, the unchanged lines between them aren't in the diff, so nittle has no text to replace. The button is disabled and the comment box says:

```
this range spans unchanged lines that are not in the diff, so it cannot carry a suggestion; comment on lines inside one hunk
```

If such a comment already holds a fence, the prompt adds `(Suggestion not expanded: ...)` with the same reason, and `get_review` leaves it out of `suggestions` and reports it in `suggestionsError` as `comment <id> (<file> <start>-<end>): ...`.

`original` is read from the diff at the moment the agent asks, by line number. If the code under the comment changed after you wrote it, `original` shows the lines that are there now. Check the card before you send feedback on an old comment.

Resolved comments drop out of both the prompt and `suggestions`, along with any comment whose lines left the diff.
