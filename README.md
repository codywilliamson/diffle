# nittle

[![CI](https://github.com/codywilliamson/nittle/actions/workflows/ci.yml/badge.svg)](https://github.com/codywilliamson/nittle/actions/workflows/ci.yml) [![Release](https://img.shields.io/github/v/release/codywilliamson/nittle)](https://github.com/codywilliamson/nittle/releases/latest) [![License: MIT](https://img.shields.io/github/license/codywilliamson/nittle)](LICENSE) [![Docs](https://img.shields.io/badge/docs-nittle.dev-blue)](https://nittle.dev)

nittle opens your local git diff in the browser like a pull request, lets you comment on exact lines, and hands those comments back to your coding agent as one structured prompt. No account, no forge, no hosted AI. It's one binary that serves on `127.0.0.1`.

![Reviewing an agent's change in nittle: comments on exact lines, then feedback sent back to the agent](docs/screenshots/walkthrough.gif)

[Watch the MP4](docs/screenshots/walkthrough.mp4) | [Docs](https://nittle.dev) | [Contributing](CONTRIBUTING.md) | [Report a security issue](SECURITY.md)

## Why I built this

Agents write code faster than I can read it, and the terminal is a bad place to read a diff. [TODO: the concrete moment that pushed you to build it, e.g. an unread agent change that bit you] A PR tool would do the job, but pushing a branch to a forge just to leave three comments for an agent running on my own machine is backwards. So nittle gives the local diff the PR treatment and sends the comments straight back to the agent that wrote the code.

## Install

You need `git` on your `PATH`. Nothing else: no Node, no checkout.

macOS and Linux:

```sh
curl -fsSL https://nittle.dev/install | sh
```

Windows needs PowerShell 7 (`pwsh`). Windows PowerShell 5.1 won't work, and `winget install --id Microsoft.PowerShell --source winget` gets you `pwsh`:

```powershell
pwsh -c "irm https://nittle.dev/install.ps1 | iex"
```

The installer downloads the binary for your OS and arch, checks its SHA-256 against the release's `checksums.txt`, and puts it in `~/.nittle/bin`. Then wire nittle into your agents:

```sh
nittle setup
```

`setup` finds the agents you have installed (Claude Code, Codex, Cursor, Gemini CLI, VS Code, Windsurf, OpenCode, Zed, GitHub Copilot CLI), shows what it will write, and asks before it writes anything. `nittle setup --remove` undoes it. Custom locations, uninstall and building from source are in the [installation guide](https://nittle.dev/getting-started/installation/).

## Your first review

```sh
cd path/to/your/repo
nittle                        # working tree vs HEAD, untracked files included
nittle show                   # the last commit, with its message and author
nittle --wait > feedback.md   # block until you return feedback, then write the prompt
```

nittle prints a `http://127.0.0.1:<port>` URL and opens it. With an agent wired up, skip the commands and ask it: `Review my current changes with nittle.` Leave comments, choose Return Feedback, and tell the agent to continue. The [quickstart](https://nittle.dev/getting-started/quickstart/) walks the whole loop.

## What it does

Review
- Any comparison: working tree, `staged`, a branch PR-style, a commit range, one commit with `nittle show`, or the whole codebase with `nittle browse`. Unified or side-by-side. [Reviewing changes](https://nittle.dev/guides/reviewing-changes/)
- Keyboard-first, vim style: `j`/`k` move a line cursor, `]`/`[` jump hunks, `10j` takes a count, `?` lists every key. [Keyboard review](https://nittle.dev/guides/keyboard-review/)

Comment
- Line, range or whole-file comments, tagged nit, issue, question or praise, with threaded replies. Unsent drafts survive a reload. [Inline comments](https://nittle.dev/guides/inline-comments/)
- Suggested changes: `Ctrl+G` in a comment drops in the lines to edit, and the agent gets the original and suggested text as structured data. [Suggested changes](https://nittle.dev/guides/suggested-changes/)

Hand back to the agent
- Over a local MCP server, the agent reads your feedback, replies in threads, marks comments addressed and asks for a re-review. Only you resolve. [Agent feedback](https://nittle.dev/guides/agent-feedback/)
- No MCP? `nittle --wait` works with any agent that can run a shell command: it blocks until you send feedback, then prints the prompt on stdout.

Triage
- The scorecard (`gc`) bands size, tests, public API, dependencies, hotspots and risk flags from fixed rules. No AI, so the same diff gets the same score every time (boring on purpose). C# is first-class. [Review scorecard](https://nittle.dev/guides/review-scorecard/)
- Review order (`m`) puts dependencies first and each file before its test. Lockfiles and generated files collapse, moved code is linked, and files the agent changed since your last round get a chip.

Navigate
- `Ctrl+p` jumps to a changed file, `/` searches the file, `g/` searches every changed file. [Searching](https://nittle.dev/guides/searching/)
- Go to definition, hover docs and references (`gd`, `gh`, `gA`) on added and removed lines, once a language server is installed for TypeScript, C#, Python, Go, Rust, Vue or Svelte. [Code navigation](https://nittle.dev/guides/code-navigation/)

Reviews live outside the repo in `~/.nittle/reviews/<id>/review.json`, and nittle never loads the reviewed repo's `.env` or `bunfig.toml`.

## Commands

| command | what it does |
| --- | --- |
| `nittle [ref]` | review a diff: none, `staged`, `<branch>`, `<ref1>..<ref2>`, `browse [path]` |
| `nittle show [rev]` | review one commit against its first parent (HEAD by default) |
| `nittle --wait [ref] [--json]` | block until feedback, print the prompt (or JSON) on stdout |
| `nittle setup` | wire nittle into your coding agents (`--remove` to undo) |
| `nittle update` | download, verify and install the latest release (`--check` to only look) |
| `nittle lsp` | show which language server each language gets, and override it |
| `nittle completion --shell <shell>` | tab completion for bash, zsh, fish or PowerShell |
| `nittle sessions` / `nittle cleanup` | list running reviews / stop stale and finished ones |
| `nittle mcp serve` | the stdio MCP server agents launch |
| `nittle doctor` | check the agent plugin install for leftovers (`--fix` to repair) |

Every flag and the `--wait` exit codes are in the [CLI reference](https://nittle.dev/reference/cli/). `nittle <command> --help` prints the same.

<details>
<summary>Keyboard shortcuts</summary>

<!-- keymap:start (generated by scripts/keymap-docs.ts) -->

Press `?` in the UI for this list at any time; it is generated from the same key table the app uses. Keys follow one grammar, vim style: an optional count, then a key or a two-key chord such as `gg`, `dd` or `yy`. `10j` moves ten lines. A count waits until the next key or `Esc`. A half-typed chord is dropped after 1 second, and so is a chord with an unknown second key, without running anything. `Esc` cancels a pending count or chord first, then closes the open dialog. Keys are ignored while you type in a field.

### Move

| key | action |
| --- | --- |
| `j` | Next line (takes a count) |
| `k` | Previous line (takes a count) |
| `J` | Next file (takes a count) |
| `K` | Previous file (takes a count) |
| `]` | Next hunk (takes a count) |
| `[` | Previous hunk (takes a count) |
| `gg` | First line of the file |
| `G` | Last line of the file, or line N with a count (takes a count) |
| `gf` | Go to the file path on the cursor line |
| `zo` | Expand the current file |
| `zc` | Collapse the current file |
| `zO` | Expand every file |
| `zC` | Collapse every file |
| `Ctrl+d` | Half a page down (takes a count) |
| `Ctrl+u` | Half a page up (takes a count) |
| `h` | Side-by-side: old side |
| `l` | Side-by-side: new side |
| `Ctrl+o` | Jump back |
| `Ctrl+i` | Jump forward |

### Comment

| key | action |
| --- | --- |
| `c` | Comment on the cursor line |
| `V` | Start a visual range (j k ] [ extend it, Esc cancels) |
| `c` | Visual range: comment on the range |
| `C` | Comment on the cursor's file |
| `gv` | Reselect the last visual range |
| `e` | Edit the comment on the cursor line |
| `dd` | Delete the comment on the cursor line |
| `u` | Undo the last comment delete (offered for 8 seconds) |
| `R` | Resolve or reopen that comment |
| `yy` | Copy that comment, or the cursor line when it has none |
| `}` | Next comment on the cursor line |
| `{` | Previous comment on the cursor line |

### Search

| key | action |
| --- | --- |
| `Ctrl+p` | Go to a changed file (fuzzy) |
| `/` | Search the file |
| `n` | Next match (takes a count) |
| `N` | Previous match (takes a count) |
| `g/` | Search all changed files |

### View

| key | action |
| --- | --- |
| `m` | File list: tree / review order |
| `t` | Light / dark theme |
| `s` | Side-by-side / unified |
| `w` | Wrap long lines |
| `o` | Single-file / all files |
| `r` | Re-run the diff |

### Review

| key | action |
| --- | --- |
| `v` | Toggle viewed on the file |
| `P` | Preview review feedback |
| `gc` | Open the review scorecard |

### Code

| key | action |
| --- | --- |
| `gd` | Go to definition (on a definition: list references) |
| `gy` | Go to type definition |
| `gh` | Hover docs for the cursor word |
| `gA` | List references |
| `gs` | Symbols in this file |
| `gS` | Symbols in the repository |
| `Ctrl/⌘ + click` | Go to definition of the word under the pointer. Resting the pointer on a word shows its hover docs. |

### Help

| key | action |
| --- | --- |
| `gw` | What's new |
| `?` | Keyboard help |
| `Esc` | Cancel a count or chord, leave the mode, close the overlay |
| `Ctrl/⌘ + Enter` | Save the open comment |

The cursor is the highlighted row. Collapsed, binary and not-yet-loaded large files have no lines to rest on, so `j` and `k` skip them and `J` and `K` park on the file header.

Keys that changed: `j` / `k` used to step files (now `J` / `K`), the scorecard moved from `g` to `gc`, feedback preview from `c` to `P`, and what's new from `n` to `gw`.

<!-- keymap:end -->

</details>

## Upgrading from diffle

The first `nittle` run moves an old diffle install over in one pass (reviews, install dir, PATH, agent plugins, MCP configs, prefs). The [migration guide](https://nittle.dev/guides/migrating-from-diffle/) covers what moves and how to retry.

## Releases

See [CHANGELOG.md](CHANGELOG.md). nittle is [MIT licensed](LICENSE).
