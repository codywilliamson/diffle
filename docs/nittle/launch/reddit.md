# Reddit drafts

Drafts for Cody. Nothing here has been posted. Check each sub's current self-promotion rules and flair requirements before posting. Both posts say plainly that Cody wrote the tool. Post them on different days and answer every comment.

## r/ClaudeAI

Title: I built a local diff reviewer that hands line comments back to Claude Code over MCP

Body:

I got tired of typing "in the second file, around the retry loop, you swallow the error" into a chat box. So I built a diff viewer where I click the line instead, and Claude gets the comment with the file, the line and the surrounding code.

It's called nittle. I wrote it. It's free and MIT licensed.

How it works with Claude Code:

    curl -fsSL https://nittle.dev/install | sh
    nittle setup

`nittle setup` finds Claude Code, shows you the commands it will run, asks, then installs the nittle-review plugin. Start a new session (or /reload-plugins) and say "review my current changes with nittle". Claude starts a review, your browser opens on the diff, and Claude waits.

You leave comments on lines, ranges or whole files, then press Return Feedback. Back in Claude Code you say "continue". Claude reads the comments, makes the changes, replies in each thread and marks them addressed. It then asks for another pass. You refresh the diff, check what it did, and either approve or send more.

The server behind it is `nittle mcp serve`. The tools Claude sees are start_review, get_review, get_scorecard, reply_to_comment, mark_comment_addressed, request_rereview and cancel_review. There's also a stop hook, `nittle hook stop --agent claude-code`, that keeps a review open until it's resolved.

A few notes:

- Keyboard review: j/k, J/K for files, ] and [ for hunks, c to comment, V for a range, e/dd/R on a thread, zo/zc to fold, Ctrl+p to jump to a file, / to search, gd for definitions. ? shows all of it.
- A scorecard that flags removed public API, missing tests and dependency changes before you read the diff. Fixed rules, no model.
- After `nittle update`, run `nittle mcp restart` and reconnect with /mcp so Claude picks up the new version.

It used to be called diffle. There's a different project with that name, they had it first, so I renamed it. The first run moves an old install's data and plugins over. If a move fails, both copies stay and it retries next run.

Docs: https://nittle.dev/guides/agent-feedback/
Repo: https://github.com/codywilliamson/nittle (formerly codywilliamson/diffle, the old URL redirects)

Screenshots to attach: nittle-review-panel.png (in docs/nittle/launch/screenshots/). Owner to capture: the agent reply thread and a Claude Code session.

How do you review what Claude Code writes today? Terminal, a PR, something else?

## r/ChatGPTCoding

Title: nittle: comment on an agent's diff line by line, works with Codex, Cursor, Gemini CLI and other agents that can run a local stdio MCP server

Body:

Disclosure: I wrote this.

Whatever agent you use, the review step is the same problem. The agent says it's done, you open a diff, and you type feedback back into a prompt in prose. Line references get fuzzy and some comments get lost.

nittle is a local diff viewer for that step. Run `nittle` in a repo, it opens the diff in your browser, you comment on lines, and it compiles the comments into a prompt you can paste into anything:

    nittle                  # working tree vs HEAD
    nittle staged           # staged only
    nittle main             # this branch vs main
    nittle show             # the last commit

If your agent speaks MCP, it can do the round trip itself. `nittle setup` wires up Codex (plugin) and Cursor, Gemini CLI, VS Code, Windsurf, OpenCode, Zed and GitHub Copilot CLI (MCP config entries). It lists exactly which files it will touch and asks before writing. Re-running is safe, and `nittle setup --remove` undoes it.

If your agent doesn't speak MCP, there's a plain version:

    nittle --wait > feedback.md

That opens the review and blocks until you return feedback, then prints the compiled prompt on stdout. Exit codes tell a script what happened: 0 feedback or approved, 2 cancelled, 3 tab closed with nothing returned.

nittle itself runs on your machine, with no account and no hosted model. It checks GitHub for updates, and the agent you hand the review to sees your comments. Comments are JSON under ~/.nittle/reviews. Single binary for macOS, Linux and Windows, x64 and arm64.

Install:

    curl -fsSL https://nittle.dev/install | sh
    pwsh -c "irm https://nittle.dev/install.ps1 | iex"    # Windows, needs PowerShell 7

Limits: go-to-definition covers seven languages today (TypeScript/JS, C#, Python, Go, Rust, Vue, Svelte) and you install the language servers yourself, no GitHub PR export, and images show a binary notice. There's a similar tool called diffle by someone else that does GitHub PR export and covers more languages. I wrote up where each of us is ahead.

Docs: https://nittle.dev

Screenshots to attach: nittle-diff-with-comments.png, nittle-keyboard-shortcuts.png (in docs/nittle/launch/screenshots/). Owner to capture: the setup terminal and the split view with a range comment.

Question for the sub: which agent are you reviewing, and do you read the diff before you accept it?
