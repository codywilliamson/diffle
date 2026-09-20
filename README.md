# loupe

Local git diff viewer for focused code review. Leave inline comments on any line, then return structured feedback to an agent or copy it manually.

**Site & docs: [codywilliamson.github.io/loupe](https://codywilliamson.github.io/loupe/)**

## Demo

![Review an agent change with Loupe](docs/screenshots/agent-review-walkthrough.gif)

The walkthrough uses a real Claude Code edit: comment, return feedback, let the agent fix and reply, refresh the diff, resolve, and approve. [Watch the MP4](docs/screenshots/agent-review-walkthrough.mp4), read the [step-by-step tutorial](docs/agent-review-walkthrough.md), or open the [site](https://codywilliamson.github.io/loupe/#demo).

## Screenshots

![loupe — a unified diff with a file tree and inline comments](docs/screenshots/01-overview.png)

| Dark mode | Inline multi-line comment | Side-by-side |
| --- | --- | --- |
| ![dark mode](docs/screenshots/02-dark.png) | ![multi-line comment](docs/screenshots/03-comments.png) | ![side-by-side diff](docs/screenshots/04-side-by-side.png) |

## Install

Loupe runs on [Bun](https://bun.sh). Clone the repo and register the `loupe` command globally — works on macOS, Linux, and Windows:

    git clone https://github.com/codywilliamson/loupe
    cd loupe
    bun install
    bun link          # puts `loupe` on your PATH

Then run `loupe` from any git repo.

**Windows fallback** — if `loupe` isn't found after `bun link` (depends how Bun was installed), add a function to your PowerShell profile instead:

    'function loupe { bun "C:\path\to\loupe\src\index.ts" @args }' | Add-Content $PROFILE
    . $PROFILE   # load it into the current session

(swap `C:\path\to\loupe` for wherever you cloned the repo.)

## Usage

    loupe                  # working tree vs HEAD (untracked included)
    loupe staged           # staged changes only
    loupe <branch>         # current branch vs named branch
    loupe <ref1>..<ref2>   # commit range
    loupe browse           # review the whole codebase
    loupe browse src/      # scope to a subtree
    loupe mcp serve        # local MCP server for agent integrations
    loupe sessions         # list running loupe sessions
    loupe cleanup          # stop stale sessions and finished reviews

Flags: `--port <n>` fixed port, `--no-open` don't launch the browser, `--version`, `--help`.
`cleanup` accepts `--yes` to skip its confirmation and `--all` to also stop active sessions.

loupe reviews whichever git repo you run it from, then prints a `http://localhost:<port>`
URL and opens it in your browser — the diff renders there, not in the terminal.

## Keyboard shortcuts

Press `?` in the UI for this list at any time.

| key | action |
| --- | --- |
| `j` / `k` | next / previous file |
| `v` | toggle viewed on the current file |
| `s` | unified ↔ side-by-side (added and deleted files stay unified) |
| `o` | single-file ↔ all-files view |
| `t` | toggle light / dark mode |
| `r` | re-run the diff |
| `c` | preview review feedback |
| `?` | show the shortcut overlay |
| `Esc` | close dialogs |

To comment on a range, drag across the line numbers or shift-click a second line.

## Review with an agent

1. Ask Codex or Claude Code: `Review my current changes with Loupe.`
2. Leave line- or file-level comments in Loupe and choose **Return Feedback**.
3. Return to the agent and say `continue`.
4. Agent replies and rereview requests appear in Loupe as they happen; choose **Refresh diff** from the notice to load the new changes.
5. Verify the changes, reply in a thread or resolve it, then approve or return more feedback. Asking the agent for more after approval reopens the same review.

Install the agent integration first — see [Agent integrations](#agent-integrations).

## Review records

Reviews are stored outside the repository under `~/.loupe/reviews/<review-id>/review.json`. Each
record keeps its Git comparison, comments, replies, addressed/resolved state, summary, and outcome.
Approved and cancelled reviews remain local until explicitly deleted.

Existing `.review` files are treated as legacy data. Loupe leaves them untouched and prompts you to
import, remove with confirmation, or ignore them.

**Resolve** a comment to keep it on the record but drop it from returned feedback and open-comment counts — reopen it any time.

When the code moves on and a comment's line or file leaves the current diff, it becomes **orphaned** — still saved, but no longer anchored anywhere in the view. **Preview Feedback** gathers these under **From earlier reviews**, where you can resolve or delete each one, and keeps them out of current feedback.

Markdown files open showing their diff; use the per-file **Preview** toggle to render them.

## Radar (experimental)

Radar ranks review units with local Git evidence and optional Jev decisions. It is off by
default. Choose **Settings → Radar mode** in the app:

- **Off** — no Radar analysis or provider requests.
- **Local only** — deterministic Git, syntax, path, and secret evidence; no model calls.
- **Jev** — bounded, redacted packets sent to the configured OpenRouter or Cloudflare provider.

The preference is stored in `~/.loupe/state.json` and applies across repositories. Environment
variables remain supported as the initial mode until a preference is saved. To start in
deterministic-only mode, use:

```text
LOUPE_RADAR=1
LOUPE_RADAR_PROVIDER=local
```

For Jev through OpenRouter, set `LOUPE_RADAR=1` plus `OPENROUTER_API_KEY`; optionally set
`LOUPE_RADAR_PROVIDER=openrouter`. For Cloudflare Workers AI, set `LOUPE_RADAR=1`,
`LOUPE_RADAR_PROVIDER=cloudflare`, `CLOUDFLARE_ACCOUNT_ID`, and
`CLOUDFLARE_API_TOKEN`. Credentials stay in the server process and are never returned to
the browser.

Remote Radar sends bounded, redacted code packets to the selected provider. Potential
secrets, binary changes, metadata-only changes, tests, generated material, and oversized
units remain local. The evidence drawer shows the exact outbound packet. Provider results
are cached under `~/.loupe/radar/` without storing raw packet code. Set
`LOUPE_RADAR_ATTENTION_THRESHOLD` to a value from `0` to `1` only when evaluating a tuned
threshold; the initial default is `0.65` pending corpus calibration.

## Agent integrations

Loupe ships explicit review skills for Codex and Claude Code that drive a review through the local MCP server. Both need the `loupe` command from [Install](#install) on your PATH.

### Codex

    codex plugin marketplace add codywilliamson/loupe
    codex plugin add loupe-review@loupe-local

Start a new Codex task after installation — existing tasks do not reload newly installed skills and
MCP servers. Then ask: `Review my current changes with Loupe.`

### Claude Code

    claude plugin marketplace add codywilliamson/loupe
    claude plugin install loupe-review@loupe-local --scope user

Start a new Claude Code session, or run `/reload-plugins` in an existing one. Then ask:
`Review my current changes with Loupe.`

If an agent reports that it cannot start the Loupe MCP server, run `loupe --version` in the same
shell. If the command is missing, rerun `bun link`, restart that shell, and start a fresh agent session.

The package sources and maintenance notes live in [`integrations/`](integrations/README.md).

## Releases

See [CHANGELOG.md](CHANGELOG.md).
