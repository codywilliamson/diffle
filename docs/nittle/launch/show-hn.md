# Show HN draft

Draft for Cody. Nothing here has been posted.

## Title

Show HN: Nittle, review your coding agent's diff line by line and send it back

Link: https://github.com/codywilliamson/nittle

Use the repo, not nittle.dev. HN readers want to see the code first, and the README has the walkthrough video and the install line at the top. The site gets linked in the comment.

Alternates, all under 80 characters:

- Show HN: Nittle, line comments on an agent's diff, handed back over MCP
- Show HN: Nittle, a local diff viewer for reviewing what coding agents write

## First comment

Post it within a minute of submitting. Keep it under 300 words. HN skims.

---

I'm Cody. I built nittle because reviewing agent output in a chat box was driving me nuts. I'd type "in the second file, around the retry loop, you swallow the error", and the agent would fix the wrong loop.

nittle is a local diff viewer. Run `nittle` in a repo and the diff opens in your browser. Click a line (or a range, or a whole file), leave a comment, press Return Feedback. The comments go back to the agent with the file, the line and the code around it. The agent can reply in the thread, mark comments addressed, and ask for another pass. You refresh and check what it actually changed.

Three ways to hand it over: copy the prompt, read it on stdout with `nittle --wait`, or let the agent drive the whole loop over a local MCP server. `nittle setup` wires up Claude Code, Codex, Cursor, Gemini CLI, VS Code, Windsurf, OpenCode, Zed and Copilot CLI, and asks before it writes anything.

Other bits:

- Vim-ish keys for everything: j/k, ]/[ for hunks, c to comment, gd for go-to-definition (7 languages, bring your own language server).
- A scorecard that flags removed public API, missing tests and dependency bumps before you start reading. Fixed rules, no model.
- Single binary, macOS/Linux/Windows. No account, nothing hosted. Comments are JSON in ~/.nittle.

Rough edges: images show a "binary file" notice, there's no GitHub PR mode yet, and language servers are a separate install.

It was called diffle until last month. Someone else had that name first, so I moved. That's the one sentence of rename story; happy to answer questions about it.

Docs and install: https://nittle.dev

I'll be in the thread all day. I want to hear where it breaks.

---

## Posting notes (first time on HN)

- When: Tuesday to Thursday, 8 to 10am US Eastern. Avoid Fridays, weekends and big Apple or OpenAI news days.
- Account: an old account with a little karma helps, but a new one works for Show HN. Comment on a few threads in the week before so it isn't a blank account.
- Don't ask anyone to upvote, and don't share a direct link to the post asking for votes. HN detects voting rings and buries the post. Telling friends "it's on HN" with the front-page link is fine.
- Answer every comment, fast, and don't argue. "Good point, I'll fix that" lands better than defending. Criticism in the first hour is normal and is how the post stays alive.
- If it gets no traction in about 2 hours, let it go. You can email hn@ycombinator.com later and ask whether it's eligible for the second-chance pool. Don't delete and repost the same day.
- Don't edit the title after posting. Mods may rewrite it, and that's fine.
- Have the install line tested on a clean machine that morning, plus the release and nittle.dev health. HN will try it in the first 20 minutes.

## Questions to expect, with short answers

- "How is this different from moritzwilksch/diffle?" Same problem, different bets. Theirs has GitHub pending-review export, range-diff and more language servers. nittle has the two-way MCP loop (reply, addressed, re-review), `nittle setup` for nine agents, and the deterministic scorecard. Link comparison.md if it's published.
- "Why not just review the PR on GitHub?" You can. nittle is for the loop before there's a PR: the agent's working tree, many rounds, no push needed.
- "Does it send my code anywhere?" nittle doesn't. It checks GitHub Releases for updates (`NITTLE_NO_UPDATE_CHECK=1` turns that off), and your comments go to whatever agent you hand them to.
- "Why a browser and not a TUI?" Range selection, side-by-side, markdown preview, and it works next to any terminal agent. The keys are vim-ish so you don't need the mouse.
