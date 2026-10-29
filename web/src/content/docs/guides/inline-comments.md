---
title: Inline comments
description: Comment on a line, a range or a whole file, reply in threads, resolve, and keep unsent drafts.
sidebar:
  order: 3
---

Leave comments on the diff as you read it. Open comments are what the agent gets back when you return feedback (see [Agent feedback](/guides/agent-feedback/)).

## Comment on a line

Hover a line and click its comment bubble, or click the line number. From the keyboard, put the cursor on the line and press `c` (see [Keyboard review](/guides/keyboard-review/)).

Type your note, optionally pick a tag (nit, issue, question or praise), and press `Ctrl+Enter` (`Cmd+Enter` on macOS) or click Save. The tag shows in the feedback as `**[issue]**`, so the agent knows how much weight to give it.

![A comment box open under a changed line, with the tag buttons on the right](/media/gallery/inline-comment.png)

## Comment on a range

Drag down the line numbers to cover several lines, or click one line number and shift-click another. From the keyboard, press `V`, extend with `j` or `k`, then `c`. The comment anchors to the whole range on one side of the diff.

![A range comment anchored to several highlighted lines](/media/gallery/range-comment.png)

To propose replacement code for those lines, press `Ctrl+G` in the box or click Suggest change. See [Suggested changes](/guides/suggested-changes/).

## Comment on a whole file

For a note that isn't about one line, click the speech-bubble icon in the file header (Comment on this file), or press `C` with the cursor in that file. File comments sit at the bottom of the file.

## Drafts

`Esc` closes the comment box and keeps what you typed. Open the box on the same line again and the text is back. The Cancel button discards it.

Unsent text is saved to the nittle server as you type, under `~/.nittle/drafts/`, one file per review. It survives a closed tab, a reload, and the next launch of the same review. Edits to an existing comment and unsent replies are kept the same way. A draft is cleared when you save it, click Cancel, or delete the comment it belongs to.

A single draft holds up to 100,000 characters, and a review keeps up to 200 drafts. Past those limits the server refuses the draft and it stays in the open box only.

## Write comments in markdown

Comments and replies render as markdown: lists, `inline code`, fenced code blocks and links. A relative image path loads from the repository, relative to the commented file. The HTML is sanitized, so nothing in a comment runs as script.

## Reply in a thread

Click Reply on a comment to answer it in place. Agents reply the same way over MCP with `reply_to_comment`, so a back-and-forth stays on the line it's about.

![A comment thread with a reply from the agent under the original comment](/media/gallery/comment-thread.png)

## Resolve or let the agent address

A comment has three states:

- Open: new, or reopened. It goes in the feedback.
- Addressed: the agent called `mark_comment_addressed` to say it made the fix. The card gets an Addressed chip. It's still open and still goes in the feedback until you check the fix and resolve it.
- Resolved: you clicked Resolve (or pressed `R`). It stays on the record but drops out of the feedback and the open-comment counts. Click Reopen to bring it back.

Only you resolve. An agent can address a comment, never resolve it.

## Stale comments

When a re-run moves a comment's line or file out of the diff, the comment isn't lost. It moves to a From earlier reviews section at the top of the diff, labeled with where it used to be, such as `src/api.ts — line 42`. Those comments are left out of the feedback. Resolve or delete each one to clear the section.

A range comment stays anchored as long as any line in its range is still in the diff.

## Where comments are kept

Comments live in a durable Review Record at `~/.nittle/reviews/<id>/review.json` (or under `NITTLE_DATA_DIR` when you set it). They outlive restarts and re-runs. Reopen a review with its id:

```sh
nittle --review-id <id>
```

`nittle sessions` lists running reviews with their ids. See [Configuration](/reference/configuration/) for the data directory.

## Related pages

- Propose replacement code with [Suggested changes](/guides/suggested-changes/).
- Send the comments to an agent with [Agent feedback](/guides/agent-feedback/).
