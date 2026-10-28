# Launch day checklist

Draft for Cody. Nothing here has been done, posted or opened. State below was last checked on 2026-10-28 against v0.32.0 (published 2026-10-20, 19 assets). The repo rename is done and github.com/codywilliamson/nittle is live. Re-read the state the day you launch.

## Order of operations

1. Repo rename (#214). Done: codywilliamson/diffle is now codywilliamson/nittle, and the old URL redirects. Still to do: confirm the small PR that flips `PRODUCT.repository` in src/core/product.ts has landed (the file still carries a comment saying it flips after the rename), and that the badge, marketplace and README links follow it.
2. Finish the rest of #214 that affects launch (the rename itself is done): reserve `nittle` on npm and crates.io, check the X and GitHub handles, update the repo description, topics and website field, and comment the new name on #126.
3. Site live. Confirm https://nittle.dev, /install, /install.ps1 and /guides/migrating-from-diffle/ return 200. The Windows one-liner is `pwsh -c "irm https://nittle.dev/install.ps1 | iex"` and needs PowerShell 7. Confirm diffle.dev 301s to the same path on nittle.dev. If landing-copy.md and readme-hero.md are going in, merge them first and let the site build.
4. Release out. Confirm the latest release is the one you want people to install and that the install one-liners fetch it. Run both one-liners in a clean VM or container, then `nittle --version` (first line `nittle v0.32.0` or whatever you release, second line the lineage). On Windows, run the one-liner from pwsh. Run `nittle setup --agents claude --yes` there and check it did what the docs say.
5. Screenshots in place. docs/nittle/launch/screenshots/ has four stills and a GIF. Capture the ones its README lists as owner to capture (setup terminal, agent reply thread, scorecard, split view) if you want them, because the posts point at it.
6. Publish the blog post (blog-post.md) so the Show HN comment can link it. Replace [BLOG_URL] in show-hn.md.
7. Decide where comparison.md lives, then replace [COMPARISON_URL] in show-hn.md. Re-check the "ahead" rows on their side the same day.
8. Post Show HN (show-hn.md). Post the first comment immediately. Stay on the thread.
9. X thread (x-thread.md) an hour or two after HN has settled.
10. Reddit (reddit.md): r/ClaudeAI one day, r/ChatGPTCoding another day. Read both subs' current self-promotion rules first.
11. The list submissions below.

## List submissions

Nothing below is submitted yet. Do these only after step 1, since entries should use the final repo URL.

### awesome-claude-code

Target: https://github.com/hesreallyhim/awesome-claude-code

This one isn't a PR. CONTRIBUTING.md says recommendations must go through the web issue form (https://github.com/hesreallyhim/awesome-claude-code/issues/new?template=recommend-resource.yml), that it is not possible with the `gh` CLI, and that a human has to submit it. Rules: the project must be at least 14 days old with continued commits, or have 100 stars (nittle's first commit is 2026-06-02). One recommendation at a time. The description is a one-line description, not a pitch, with no emoji.

Entry text:

> nittle: a local git diff viewer that returns line-level review comments to Claude Code over MCP, with a plugin installed by `nittle setup`. Agents reply in the thread and request re-review.

Link: https://github.com/codywilliamson/nittle

### punkpeye/awesome-mcp-servers

Target: https://github.com/punkpeye/awesome-mcp-servers (PR against README.md, the Developer Tools section, in alphabetical order)

Their CONTRIBUTING.md asks for a fork, a branch, one line in the README in the existing format, and a PR with a clear description. Legend icons used in the entry: TypeScript, local service, macOS, Windows, Linux.

Entry text:

    - [codywilliamson/nittle](https://github.com/codywilliamson/nittle) 📇 🏠 🍎 🪟 🐧 - Local diff review for coding agents. Start a review of a git diff, read the reviewer's line comments, reply, mark them addressed and request re-review.

PR title: `Add nittle`

Check the README's current format before opening: some entries carry a glama.ai score badge. Check whether you need one.

### Official MCP Registry

Target: https://registry.modelcontextprotocol.io/ (not a PR)

The modelcontextprotocol/servers README now points to the registry for community servers and keeps only reference servers itself, so do not open a PR there. Publishing to the registry is done with its `mcp-publisher` tool and a `server.json`, which needs a decision on package type first (nittle ships as a binary and an MCPB, and npm publishing is gated behind a repo variable in release.yml). Treat this as a separate task, not part of launch day.

### Optional

- wong2/awesome-mcp-servers (https://github.com/wong2/awesome-mcp-servers) is another list. Its README says it does not accept PRs and sends submissions to the form at https://mcpservers.org/submit, which is a submit-by-hand job for you.
- appcypher/awesome-mcp-servers is archived. Skip it.

## Day-of watch list

- GitHub issues on the repo, and the HN thread. Answer every question about the rename plainly.
- `gh release view --json assets -R codywilliamson/nittle` still shows all assets (it needs `gh auth login` first). The installers depend on them.
- The rough edges line in show-hn.md (images, no GitHub PR mode, language servers installed separately). Comment keys shipped in 0.31.0, so that line no longer mentions them. Re-check it against whatever you release.
