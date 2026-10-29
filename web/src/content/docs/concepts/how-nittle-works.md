---
title: How nittle works
description: What happens between running nittle and your agent reading the feedback, and why all of it stays on your machine.
sidebar:
  order: 1
---

When you run `nittle` in a repository, it turns the ref you gave it into a plain `git diff` and runs it locally. No argument means your working tree against `HEAD`, untracked files included. `nittle main` is a three-dot comparison against `main`. The output is parsed into files, hunks and numbered lines, and a small server bound to `127.0.0.1` serves it to the browser tab that opens.

After the first page load, every request for the diff runs git again. That happens when you press `r` or click Re-run the diff (the circular arrow) in the top bar. When an agent edits files mid-review, a re-run shows the new code with no restart and no new review.

The review lives in a Review Record, a JSON file at `~/.nittle/reviews/<id>/review.json`. It holds what you're comparing, your comments, the files you marked viewed, your summary, and a log of what you and the agent did. Because it's on disk, a review outlives the tab, the server and a reboot, and `nittle --review-id <id>` opens it again. Unsent comment drafts are kept under `~/.nittle/drafts/`, so a reload doesn't lose what you typed.

A comment is pinned to a file, a side (new or removed lines) and a line number or range. On each re-run nittle checks that the line number still appears in the diff. If the file left the diff, or every line in the range fell outside the changed hunks, the comment moves to a From earlier reviews section at the top of the diff instead of vanishing.

Anchoring is by number, so a comment can land on a different line when edits above it shift the file. Re-read the code under an old comment before you trust it.

Your open comments compile into a markdown prompt. The compiler is a pure function of the diff, the comments and your summary. It reads no clock (the header date comes from the record), sorts files by path and comments by range, and shows each commented line with two lines of context either side. Resolved comments and comments that lost their anchor are left out. The same review always produces the same prompt, byte for byte, so you can diff it and test against it.

How the agent gets it depends on how you wired it up. An agent without MCP runs `nittle --wait`, which blocks until you send feedback and then prints that prompt on stdout. An agent connected over MCP (`nittle setup` does this) calls `start_review`, waits for you, then calls `get_review`. That returns the structured record instead of prose: each comment with its anchor, tag and reply thread, plus suggested changes as arrays of original and replacement lines.

The agent can reply, mark a comment addressed and call `request_rereview`. It can't resolve a comment or approve the review. Those buttons are yours.

Each time you return feedback, nittle records a round: the git blob hash of every file's new-side content. When the agent asks for another look, any file whose content no longer matches gets a Changed since last review chip and a toggle that shows only what changed since then. You check the fix without re-reading the whole change.

The scorecard (`gc`) is fixed arithmetic on the same diff with no model involved, so `get_scorecard` gives the agent exactly the bands you see. The rules are in [Review scorecard](/guides/review-scorecard/).

All of this runs on your machine. nittle has no account and no hosted service, and it sends your code to no AI model. Your diff and comments only reach an agent when you hand them over, through a pipe or a local MCP server the agent started.

The only calls nittle makes on its own are release checks against GitHub Releases, and they carry nothing from your repo. One runs at launch, at most once a day. The other is the update badge in the open tab, which asks every 10 minutes while the tab is open. `NITTLE_NO_UPDATE_CHECK=1` silences the launch notice and the release check in `nittle doctor`, but the badge still polls.

To run the loop end to end, follow the [Quickstart](/getting-started/quickstart/). The MCP side is in [Agent feedback](/guides/agent-feedback/).
