# nittle.dev landing copy draft

Draft for Cody. This covers the first screen of web/src/pages/index.astro. Nothing is applied to the site.

The lineage line is the same string as the README hero and `nittle --version`. In the Astro file the ampersand is written as `&amp;`.

---

Eyebrow: local diff review for coding agents

Headline: Read what your agent wrote, one line at a time.

Lede: nittle opens your git diff in the browser. You comment on the exact lines, and the comments go back to your agent as a structured prompt or over a local MCP server. The agent replies in the thread, you refresh the diff, and you check what it changed. There's no forge, account or hosted model to set up.

Lineage: nittle, fka diffle (the Deterministic Inspection & Feedback Framework for Language-model Engineering, per ADR 0004, which we stand by), fka loupe

Install, macOS and Linux:

    curl -fsSL https://nittle.dev/install | sh

Install, Windows:

    irm https://nittle.dev/install.ps1 | iex

Under the install box: one binary. It needs only git on your PATH, and `nittle update` keeps it current.

Buttons: Quickstart (/getting-started/quickstart/) and GitHub.

Below the fold, three short blocks. Each takes one screenshot from launch/screenshots/.

Comment on the line that's wrong.
Click a line, drag a range, or press `c`, or `V` then `c`. Comments anchor to the code. If the code goes away, they're marked stale instead of disappearing. Shot: 02-inline-comment.png.

Send it back and get a reply.
`nittle setup` wires nittle into Claude Code, Codex, Cursor, Gemini CLI, VS Code, Windsurf, OpenCode, Zed and GitHub Copilot CLI. The agent replies to a comment, marks it addressed, and asks for another pass. Shot: 04-agent-reply-thread.png.

Start with the risky parts.
A scorecard for size, tests, public API, dependencies and hotspots, from fixed rules, not a model. Press `m` to order files with dependencies first. Shot: 05-scorecard.png.

Coming from diffle? The first run of nittle moves your data and plugins and removes the old install. See /guides/migrating-from-diffle/.
