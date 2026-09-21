---
name: diffle-review
description: Start and continue an explicit Diffle review through the local MCP server.
---

# Diffle review

Use Diffle when the user explicitly asks to review a Git comparison. For current changes, call `start_review` with the exact working directory and ref `working`. Use `staged`, a branch, or a range only when the user requests that comparison. Then honor the Review Policy. For `required`, yield the turn at the Review Hold; when the user resumes, call `get_review` once.

Apply each returned Review Comment, reply with what changed, mark it addressed, and call `request_rereview`. The Review Summary is feedback too, and a Feedback Bundle may contain only a summary — read it even when there are no comments. Read each comment's replies first — a reviewer reply that comes after the agent's own last reply on that comment means it still needs work. The reviewer alone approves, resolves, or reopens comments. A direct user instruction to continue without waiting overrides only the Review Hold; it does not change the Review Outcome.

If the user asks for further changes after approval, make them and call `request_rereview` on the same review to reopen it rather than starting a new review.

Diffle's server stops with the agent session; when `start_review` returns a non-zero `staleSessions`, mention that `diffle cleanup` will close old ones.
