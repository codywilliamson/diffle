# Show HN draft

Draft for Cody. Nothing here has been posted.

## Title

Show HN: Nittle, line-by-line review of agent diffs, sent back over MCP

URL: https://nittle.dev

Alternates if the first reads long:

- Show HN: Nittle, line-level review for the coding agent loop
- Show HN: Nittle, comment on an agent's diff and hand the comments back

## First comment

Post this as soon as the submission is up. Replace [COMPARISON_URL] with wherever comparison.md ends up living (see launch-checklist.md).

---

Hi HN. I'm Cody. nittle is a local git diff viewer built for reviewing what coding agents write.

You run `nittle` in a repo and it opens the diff in your browser. You comment on a line, a range, or a whole file. The comments go back to the agent as a structured prompt. You paste it, send it over a local MCP server, or read it on stdout with `nittle --wait`. The agent can reply in the thread, mark a comment addressed, and ask for another pass. You refresh the diff and look at what it changed. nittle itself runs locally, with no forge, no account and no hosted model. Update checks call GitHub, and the agent you hand the review to sees what you send it.

Install:

    curl -fsSL https://nittle.dev/install | sh
    pwsh -c "irm https://nittle.dev/install.ps1 | iex"      # Windows, needs PowerShell 7

Then `nittle setup` wires it into the agents you have: Claude Code and Codex (as plugins), plus Cursor, Gemini CLI, VS Code, Windsurf, OpenCode, Zed and GitHub Copilot CLI (as MCP config entries). It shows you the plan and asks before it touches a file.

Why line-level review. When an agent reviews its own work, it reads the same context it wrote from, so it tends to agree with itself. A human pointing at line 48 and saying "this swallows the error" gives it something more specific than "review your changes". That's the bet. I wrote it up here: [BLOG_URL]

Naming is the messy part. This project was called diffle until the rename, and loupe before that. I started it in June as loupe and moved to diffle in September. moritzwilksch/diffle is a different project with the same name. It was already public, and it had its own Show HN earlier this month. They had the name first, we built independently, and we kept colliding in search, package names and "which diffle?" threads. I'd rather be the one who moves than make everyone sort out which diffle they mean, so we moved. The first run of nittle moves a diffle install's data and plugins over. If a move fails, both copies stay and it retries on the next run. There's a page on it: https://nittle.dev/guides/migrating-from-diffle/

The old name had a backronym, the Deterministic Inspection & Feedback Framework for Language-model Engineering. It's in ADR 0004 in the repo. We stand by it, and `nittle --version` still prints the lineage on its second line.

How it differs from moritzwilksch/diffle. Same problem, different choices. Where they're ahead: they have symbol stepping, a copy-path key and a whole-file key, they support more language servers, they can export comments to a GitHub pending review, they have range-diff and image diffs, and they publish to npm and conda-forge. Where nittle goes the other way: the MCP server and the two-way loop (reply, addressed, request re-review), `nittle setup` for nine agents, a deterministic scorecard and review order (no model involved), moved-code detection, and `nittle browse` for reviewing a whole tree. The row-by-row list with links to the code on both sides is here: [COMPARISON_URL]

Some details you can check yourself:

- Single binary for macOS, Linux and Windows on x64 and arm64. Running nittle needs only git on PATH. A browser shows the UI, and language servers are optional.
- `nittle update` verifies the SHA-256 before it swaps the binary.
- Keys are vim-ish: j/k with counts, J/K for files, ] and [ for hunks, c/V/C to comment, e/dd/R/yy on a thread, zo/zc to fold, gf and Ctrl+p to jump to a file, / and g/ to search, gd/gy/gh/gA/gs/gS for language server navigation. `?` shows the full list.
- Seven languages have go-to-definition today: TypeScript/JS, C#, Python, Go, Rust, Vue, Svelte. You install the language servers yourself. nittle uses one you set with `nittle lsp set`, or one it finds on PATH (Python looks in the virtualenv first). It won't run executables from the repo under review. `nittle lsp` shows what it found.
- Comments are plain JSON under ~/.nittle/reviews. MIT licensed.

Rough edges I know about: images show a "binary file" notice instead of a visual diff, there's no GitHub PR mode, and the language servers are a separate install.

I'll be here all day. If the docs read like a machine wrote them anywhere, tell me where and I'll rewrite it.
