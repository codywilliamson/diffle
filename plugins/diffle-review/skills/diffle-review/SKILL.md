---
name: diffle-review
description: Start and continue an explicit Diffle review through the local MCP server, in rounds or interactively (answering comments live as the reviewer writes them).
---

# Diffle review

Use Diffle when the user explicitly asks to review a Git comparison. For current changes, call `start_review` with the exact working directory and ref `working`. Use `staged`, a branch, or a range only when the user requests that comparison. Then honor the Review Policy. For `required`, yield the turn at the Review Hold; when the user resumes, call `get_review` once.

Apply each returned Review Comment, reply with what changed, mark it addressed, and call `request_rereview`. The Review Summary is feedback too, and a Feedback Bundle may contain only a summary — read it even when there are no comments. Read each comment's replies first — a reviewer reply that comes after the agent's own last reply on that comment means it still needs work. The reviewer alone approves, resolves, or reopens comments. A direct user instruction to continue without waiting overrides only the Review Hold; it does not change the Review Outcome.

An agent may call `get_scorecard` to see the same deterministic flags the reviewer sees.

If the user asks for further changes after approval, make them and call `request_rereview` on the same review to reopen it rather than starting a new review.

Diffle's server stops with the agent session; when `start_review` returns a non-zero `staleSessions`, mention that `diffle cleanup` will close old ones.

## Interactive review

When the user asks to review interactively or live ("review with me", "answer my comments as I write them"), start the review as above, then skip the Review Hold and loop on `wait_for_comments`:

1. Call `wait_for_comments`. It blocks until a comment needs you and returns it in `pending`: a comment is pending while it is unresolved and the reviewer spoke last. When `timedOut` is true and nothing is pending, call it again at once; do not end the turn or ask the user. If your client moves the call to the background, wait for its result; never run two waits at once.
2. For each pending comment, read its replies first. Answer a question with `reply_to_comment`. For a change request, edit the working tree, reply with what changed, then `mark_comment_addressed`. Always reply: a comment where the reviewer spoke last stays pending until you do.
3. Call `wait_for_comments` again.

The returned `review.status` ends or redirects the loop. `approved` or `cancelled`: stop and report. `feedback_ready`: the reviewer returned a batch; handle it as a normal round, call `request_rereview`, then resume the loop. Also stop when the user interrupts in the chat.
