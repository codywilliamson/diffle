# nittle

[![CI](https://github.com/codywilliamson/nittle/actions/workflows/ci.yml/badge.svg)](https://github.com/codywilliamson/nittle/actions/workflows/ci.yml) [![Release](https://img.shields.io/github/v/release/codywilliamson/nittle)](https://github.com/codywilliamson/nittle/releases/latest) [![License: MIT](https://img.shields.io/github/license/codywilliamson/nittle)](LICENSE) [![Docs](https://img.shields.io/badge/docs-nittle.dev-blue)](https://nittle.dev)

Local git diff viewer for focused code review. Leave inline comments on any line, then return structured feedback to an agent or copy it manually.

nittle, fka diffle (the Deterministic Inspection & Feedback Framework for Language-model Engineering, per ADR 0004, which we stand by), fka loupe.

**Site & docs: [nittle.dev](https://nittle.dev)**

Want to help? Read the [contribution guide](CONTRIBUTING.md). Please [report security issues privately](SECURITY.md).

## Demo

![Review an agent change with nittle](docs/screenshots/walkthrough.gif)

Review a diff, comment on exact lines, and export structured feedback for your agent. [Watch the MP4](docs/screenshots/walkthrough.mp4) or read the [docs](https://nittle.dev).

Side-by-side diffs have independent horizontal scrolling and a resizable divider. Line numbers and comments stay visible, and wrapped lines stay aligned across both sides. [Reviewing changes](https://nittle.dev/guides/reviewing-changes/) covers the pointer and keyboard controls.

## Screenshots

![nittle — a unified diff with a file tree and inline comments](docs/screenshots/overview.png)

| Inline comment | Side-by-side | Structured feedback |
| --- | --- | --- |
| ![inline comment](docs/screenshots/comment.png) | ![side-by-side diff](docs/screenshots/side-by-side.png) | ![feedback preview](docs/screenshots/feedback.png) |

## Install

nittle ships as a single self-contained binary — no checkout, no Node, no sidecar files. It needs only **`git`** on your `PATH`.

```sh
# macOS / Linux
curl -fsSL https://nittle.dev/install | sh
```

```powershell
# Windows (needs PowerShell 7+)
pwsh -c "irm https://nittle.dev/install.ps1 | iex"
```

Windows PowerShell 5.1 is not supported. If you don't have `pwsh`, install it with `winget install --id Microsoft.PowerShell --source winget`.

The installer downloads the binary for your OS/arch, verifies its SHA-256 against the published checksums, and installs it to `~/.nittle/bin`. On macOS and Linux it also adds that directory to your login shell's rc file inside a `# >>> nittle >>>` marker block — run `exec $SHELL -l` to use it in the current shell, opt out with `NITTLE_NO_MODIFY_PATH=1`, or undo it with `curl -fsSL https://nittle.dev/install | NITTLE_UNINSTALL=1 sh`. On a terminal, the installer then offers to run `nittle setup` to wire nittle into your coding agents (skip with `NITTLE_NO_SETUP=1`). Keep it current with `nittle update`. Full instructions — custom locations, uninstall, building from source — are in the [installation guide](https://nittle.dev/getting-started/installation/).

## Usage

```sh
nittle                  # working tree vs HEAD (untracked included)
nittle staged           # staged changes only
nittle <branch>         # current branch vs named branch (PR-style)
nittle <ref1>..<ref2>   # commit range
nittle browse           # review the whole codebase
nittle browse src/      # scope to a subtree
nittle mcp serve        # local MCP server for agent integrations
nittle mcp list         # list running MCP servers
nittle mcp restart      # stop MCP servers so agents relaunch them (e.g. after an update)
nittle setup            # wire nittle into your coding agents (--remove to undo)
nittle sessions         # list running nittle sessions
nittle cleanup          # stop stale sessions and finished reviews
nittle update           # self-update to the latest release
nittle update --check   # only report whether a newer release exists
nittle --license         # print the bundled MIT license notice
nittle doctor           # check the Claude Code plugin install (--fix to repair)
```

Flags: `-p, --port <n>` fixed port, `--no-open` don't launch the browser, `--review-id <id>` reopen a record, `-v, --version`, `--license`, `-h, --help`. `cleanup` accepts `--yes` to skip its confirmation and `--all` to also stop active sessions. `doctor` accepts `--fix` to run the repair commands and `--yes` to skip its confirmation. `mcp restart` accepts `--yes`. `setup` accepts `--remove`, `--agents <id,id>`, and `--yes`. Run `nittle <command> --help` for a command's options and examples. `nittle update` finishes by listing the next steps that apply (restart open reviews, reconnect agents, `nittle mcp restart`).

nittle reviews whichever git repo you run it from, then prints a `http://127.0.0.1:<port>` URL and opens it in your browser — the diff renders there, not in the terminal.

## Review scorecard

The **Scorecard** (`gc`) summarizes a diff before you read it: size, test coverage, public API, dependencies, hotspots, and risk flags. Each category is Low, Medium, or High from fixed rules, not AI. **Review order** (`m`) groups files by project, with dependencies first and each source file before its test. See [the review scorecard guide](https://nittle.dev/guides/review-scorecard/).

## Keyboard shortcuts

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

To comment on a range, drag across the line numbers or shift-click a second line.

## Review with an agent

1. Ask Codex or Claude Code: `Review my current changes with nittle.`
2. Leave line- or file-level comments in nittle and choose **Return Feedback**.
3. Return to the agent and say `continue`.
4. Agent replies and rereview requests appear in nittle as they happen; choose **Refresh diff** from the notice to load the new changes.
5. Verify the changes, reply in a thread or resolve it, then approve or return more feedback. Asking the agent for more after approval reopens the same review.

Install the agent integration first — see [Agent integrations](#agent-integrations).

## Review records

Reviews are stored outside the repository under `~/.nittle/reviews/<review-id>/review.json`. Each
record keeps its Git comparison, comments, replies, addressed/resolved state, summary, and outcome.
Approved and cancelled reviews remain local until explicitly deleted.

**Resolve** a comment to keep it on the record but drop it from returned feedback and open-comment counts — reopen it any time.

When the code moves on and a comment's line or file leaves the current diff, it becomes **orphaned** — still saved, but no longer anchored anywhere in the view. **Preview Feedback** gathers these under **From earlier reviews**, where you can resolve or delete each one, and keeps them out of current feedback.

Markdown files open showing their diff; use the per-file **Preview** toggle to render them.

## Agent integrations

nittle ships explicit review skills for Codex and Claude Code that drive a review through the local MCP server, and can register the MCP server with Cursor, Gemini CLI, VS Code, Windsurf, OpenCode, Zed, and GitHub Copilot CLI. All need the `nittle` command from [Install](#install) on your `PATH`.

The quickest route is `nittle setup`: it detects your installed agents, lets you pick which to wire up, shows exactly what it will run or write, and asks before applying. It's idempotent, and `nittle setup --remove` undoes it. Pass `--agents claude,codex` to skip the picker and `--yes` to skip the confirmation.

```sh
nittle setup
```

Or install the plugins by hand:

```sh
# Claude Code
claude plugin marketplace add codywilliamson/nittle
claude plugin install nittle-review@nittle-local --scope user

# Codex
codex plugin marketplace add codywilliamson/nittle
codex plugin add nittle-review@nittle-local
```

Start a fresh agent session afterwards (or run `/reload-plugins` in Claude Code), then ask
`Review my current changes with nittle.` The plugin is named `nittle-review`. Package sources and
maintenance notes live in [`integrations/`](integrations/README.md); see the [agent feedback guide](https://nittle.dev/guides/agent-feedback/) for the full loop.

## Upgrading from diffle



## Releases

See [CHANGELOG.md](CHANGELOG.md).
