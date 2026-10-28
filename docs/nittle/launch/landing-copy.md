# nittle.dev landing copy draft

Draft for Cody. This covers the first screen of web/src/pages/index.astro. Nothing is applied to the site.

The lineage line is "nittle, " followed by `PRODUCT.lineage`, the same as the README hero. `nittle --version` prints `PRODUCT.lineage` alone on its second line. In the Astro file the ampersand is written as `&amp;`.

---

Eyebrow: local diff review for coding agents

Headline: Read what your agent wrote, one line at a time.

Lede: nittle opens your git diff in the browser. You comment on the exact lines, and the comments go back to your agent as a structured prompt or over a local MCP server. The agent replies in the thread, you refresh the diff, and you check what it changed. nittle itself needs no forge, account or hosted model. The agent you hand the review to sees your comments.

Lineage: nittle, fka diffle (the Deterministic Inspection & Feedback Framework for Language-model Engineering, per ADR 0004, which we stand by), fka loupe

Install, macOS and Linux:

    curl -fsSL https://nittle.dev/install | sh

Install, Windows:

    pwsh -c "irm https://nittle.dev/install.ps1 | iex"

Under the Windows command: needs PowerShell 7.

Under the install box: one binary. Running nittle needs only git on your PATH. A browser shows the UI, and language servers are optional and installed separately. `nittle update` keeps it current.

Buttons: Quickstart (/getting-started/quickstart/) and GitHub (https://github.com/codywilliamson/nittle).

Below the fold, three short blocks. Each takes one screenshot from docs/nittle/launch/screenshots/.

Comment on the line that's wrong.
Click a line, drag a range, or press `c`, or `V` then `c`. Comments anchor to the code. If the file or line no longer appears in the diff, they're listed as stale instead of disappearing. Shot: nittle-diff-with-comments.png.

Send it back and get a reply.
`nittle setup` wires nittle into Claude Code, Codex, Cursor, Gemini CLI, VS Code, Windsurf, OpenCode, Zed and GitHub Copilot CLI. The agent replies to a comment, marks it addressed, and asks for another pass. Shot: agent reply thread, owner to capture.

Start with the risky parts.
A scorecard for size, tests, public API, dependencies and hotspots, from fixed rules, not a model. Press `m` to order files for review: dependencies first for C# projects (ProjectReferences), grouped by package or folder for TypeScript and JS. Shot: scorecard, owner to capture (nittle-review-panel.png is the stand-in).

Coming from diffle? The first run of nittle moves your data and plugins and removes the old install's entries. If a move fails, both copies stay and it retries on the next run. See /guides/migrating-from-diffle/.
