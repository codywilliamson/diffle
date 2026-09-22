---
title: MCP tools
description: The tools diffle's local MCP server exposes to coding agents.
sidebar:
  order: 3
---

`diffle mcp serve` runs a local stdio MCP server (server name `diffle`). The agent integrations for Claude Code and Codex use it; see [Agent feedback](/guides/agent-feedback/) for setup.

The server only operates on a cwd inside an approved root (see `DIFFLE_ROOT` in [Configuration](/reference/configuration/)).

```sh
diffle mcp serve
```

If the `diffle` server doesn't show up in your agent, run `diffle doctor` — a stale `loupe-review` plugin keeps the old server wired in its place.

## Tools

| tool | purpose | inputs |
| --- | --- | --- |
| `start_review` | start a review of a git comparison and open it in the browser | `cwd` (required), `ref` (required — use `"working"` for current tracked+untracked changes; otherwise a staged/branch/range comparison), `policy` (optional: `required` \| `handoff` \| `off`), `origin` (optional agent/session metadata) |
| `get_review` | inspect the durable status and feedback of a review | `reviewId` |
| `reply_to_comment` | reply to an unresolved review comment as the agent | `reviewId`, `commentId`, `text` |
| `mark_comment_addressed` | mark a reviewer comment addressed after making the change | `reviewId`, `commentId` |
| `request_rereview` | tell the reviewer changes are ready for another pass (reopens an approved review rather than failing) | `reviewId`, `summary` (optional) |
| `cancel_review` | cancel an active review without approving it | `reviewId`, `summary` (optional) |

## The `ref` argument

Always pass `"working"` for the current changes — tracked plus untracked. Use another comparison only when explicitly requested: staged changes, a branch, or a `a..b` range.

```json
{ "cwd": "/abs/path/to/repo", "ref": "working" }
```

## Review policy

`policy` controls how the agent behaves after starting a review:

| policy | behavior |
| --- | --- |
| `required` | the agent should wait for the human review |
| `handoff` | hand off and continue |
| `off` | no review gate |

## Note

Most agents call these tools for you via the review skill — you rarely invoke them by hand. See [Agent feedback](/guides/agent-feedback/).
