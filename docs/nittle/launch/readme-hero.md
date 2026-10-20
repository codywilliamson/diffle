# README hero draft

Draft for Cody. This replaces the top of README.md, from the title down to the Install heading. Nothing is applied to README.md.

The lineage line appears once, exactly as below, and is the same string as `PRODUCT.lineage` in src/core/product.ts and the second line of `nittle --version`.

---

# nittle

Review the diff your coding agent wrote. Comment on the exact lines, send the comments back, and look at what it changed.

nittle is a local git diff viewer. You run `nittle` in a repo and it opens the diff in your browser. You comment on a line, a range or a file. The comments go back to your agent as a structured prompt, by copy and paste, over a local MCP server, or on stdout with `nittle --wait`. The agent can reply in the thread and ask for another pass. It all stays on your machine. You don't need a forge, an account, or a hosted model.

nittle, fka diffle (the Deterministic Inspection & Feedback Framework for Language-model Engineering, per ADR 0004, which we stand by), fka loupe.

```sh
# macOS / Linux
curl -fsSL https://nittle.dev/install | sh
```

```powershell
# Windows
irm https://nittle.dev/install.ps1 | iex
```

Then, in a git repo:

```sh
nittle                 # working tree vs HEAD
nittle setup           # wire it into Claude Code, Codex, Cursor, Gemini CLI and more
```

![Review an agent change with nittle](docs/screenshots/walkthrough.gif)

[Docs](https://nittle.dev) | [Quickstart](https://nittle.dev/getting-started/quickstart/) | [Agent feedback loop](https://nittle.dev/guides/agent-feedback/) | [Coming from diffle](https://nittle.dev/guides/migrating-from-diffle/)

---

Notes for Cody

- The existing README already carries the lineage line under the intro. If you apply this, keep only one copy.
- The walkthrough image is the existing docs/screenshots/walkthrough.gif. launch/screenshots/ lists the new shots if you want a hero still instead.
