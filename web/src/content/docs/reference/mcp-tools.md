---
title: MCP tools
description: The seven tools nittle's local MCP server exposes to coding agents, with parameters, types, return shapes and errors.
sidebar:
  order: 4
---

`nittle mcp serve` runs a stdio MCP server named `nittle`. `nittle setup` wires it into your agents; see [Agent feedback](/guides/agent-feedback/). Shapes named here are defined in `src/types.ts` (`ReviewRecord`, `ReviewSuggestion`, `ReviewScorecard`) and `src/mcp/operations.ts` (the result wrapper).

## Tools

| tool | does | read-only | idempotent | destructive |
| --- | --- | --- | --- | --- |
| [`start_review`](#start_review) | start a review and open it in the browser | no | no | no |
| [`get_review`](#get_review) | status, comments and structured suggestions for a review | yes | yes | no |
| [`get_scorecard`](#get_scorecard) | the deterministic scorecard the reviewer sees | yes | yes | no |
| [`reply_to_comment`](#reply_to_comment) | reply to a comment as the agent | no | no | no |
| [`mark_comment_addressed`](#mark_comment_addressed) | mark a comment addressed | no | yes | no |
| [`request_rereview`](#request_rereview) | ask for another pass | no | no | no |
| [`cancel_review`](#cancel_review) | cancel a review without approving it | no | yes | yes |

## Results and errors

| outcome | MCP response |
| --- | --- |
| success | `structuredContent` holds the result object, and `content[0].text` holds the same object as JSON |
| failure | `isError: true`, and `content[0].text` holds the message |

Every tool except `get_scorecard` returns this result object (`ReviewOperationResult`):

| field | type | present on |
| --- | --- | --- |
| `review` | `ReviewRecord` | every tool |
| `url` | `string` | `start_review` |
| `staleSessions` | `number` | `start_review`: stale or orphaned nittle sessions found at start |
| `suggestions` | `ReviewSuggestion[]` | `get_review` |
| `suggestionsError` | `string` | `get_review`, only when `suggestions` is incomplete |

Errors any tool that takes a `reviewId` can return:

| message | cause |
| --- | --- |
| `review record not found` | no record with that id |
| `invalid review id` | the id has characters outside `A-Z a-z 0-9 _ -`, or is over 128 characters |
| `review record is terminal` | the review is approved or cancelled (`request_rereview` accepts approved) |
| `comment not found` | no comment with that `commentId` |

## `start_review`

| param | type | required | constraint |
| --- | --- | --- | --- |
| `cwd` | `string` | yes | the repo path; must be inside the approved root (`NITTLE_ROOT`, else the server's start directory) |
| `ref` | `string` | yes | 1 to 500 chars. `"working"` for tracked plus untracked changes; otherwise `"staged"`, a branch, or `a..b` |
| `policy` | `"required" \| "handoff" \| "off"` | no | default `"required"` |
| `origin` | object | no | see below |

| `origin` field | type | constraint |
| --- | --- | --- |
| `agent` | `"codex" \| "claude-code"` | |
| `sessionId` | `string` | 1 to 200 chars |
| `taskId` | `string` | 1 to 200 chars |
| `originalRequest` | `string` | max 10,000 chars |
| `summary` | `string` | max 10,000 chars |

| policy | meaning for the agent |
| --- | --- |
| `required` | wait for the human review |
| `handoff` | hand off and continue |
| `off` | no review gate |

```json
{ "cwd": "/home/me/app", "ref": "working", "origin": { "agent": "claude-code" } }
```

Returns `{ review, url, staleSessions }`. Opens the browser unless `NITTLE_NO_OPEN=1`.

| error | cause |
| --- | --- |
| `cwd must be inside an approved MCP root` | `cwd` is outside `NITTLE_ROOT` (or the start directory) |
| `No approved MCP root is available` | no root configured |
| `No changes found for "<ref>". Use ref "working" for current tracked and untracked changes, or verify the requested comparison.` | the comparison is empty |
| `not a git repository (run nittle inside one)` | `cwd` is not in a git repo |
| `unknown ref: <ref>` | git can't resolve `ref` |

## `get_review`

| param | type | required | constraint |
| --- | --- | --- | --- |
| `reviewId` | `string` | yes | 1 to 200 chars |

Returns `{ review, suggestions, suggestionsError? }`. `nittle --wait --json` prints the same object.

`suggestions` lists every `suggestion` fence in the open (not resolved) line and range comments, in comment order, so the agent can apply them without parsing comment text.

| `ReviewSuggestion` field | type | meaning |
| --- | --- | --- |
| `commentId` | `string` | the comment that holds the fence |
| `path` | `string` | repo-relative file |
| `side` | `"old" \| "new"` | which side the line numbers count on |
| `startLine` | `number` | first anchored line, 1-based |
| `endLine` | `number` | last anchored line, inclusive |
| `original` | `string[]` | the anchored lines as currently in the diff |
| `suggested` | `string[]` | the replacement lines; `[]` means delete the original lines |

A range that crosses unchanged lines outside the diff is left out of `suggestions` and reported in `suggestionsError`: `comment <id> (<file> <start>-<end>): this range spans unchanged lines that are not in the diff, so it cannot carry a suggestion; comment on lines inside one hunk`. When the diff can't be re-read, `suggestions` is `[]` and `suggestionsError` starts with `could not read the review's diff:`.

Real result for a comment with one suggestion (the `review` record is trimmed):

```json
{
  "review": { "id": "...", "status": "awaiting_human", "policy": "required" },
  "suggestions": [
    {
      "commentId": "c1",
      "path": "retry.ts",
      "side": "new",
      "startLine": 2,
      "endLine": 2,
      "original": ["  const delay = n * 1000;"],
      "suggested": ["  const delay = n * RETRY_DELAY_MS;"]
    }
  ]
}
```

### `ReviewRecord`

| field | type |
| --- | --- |
| `schemaVersion` | `1` |
| `id` | `string` |
| `target` | `{ cwd, ref, spec?, meta? }` |
| `origin` | `{ agent?, sessionId?, taskId?, originalRequest?, summary? }`, optional |
| `policy` | `"required" \| "handoff" \| "off"` |
| `status` | `"awaiting_human" \| "feedback_ready" \| "approved" \| "cancelled"` |
| `summary` | `string`, optional: the reviewer's summary |
| `createdAt`, `updatedAt` | ISO 8601 `string` |
| `viewed` | `string[]`: paths marked viewed |
| `comments` | `Comment[]` |
| `activity` | `ReviewActivity[]`: `{ id, type, actor, createdAt, commentId?, summary? }` |
| `lastRound` | `{ capturedAt, blobs }`, optional: set when feedback is returned |

| `Comment` field | type |
| --- | --- |
| `id` | `string` |
| `file` | `string` |
| `side` | `"old" \| "new"`, optional, default `"new"` |
| `line` | `number \| null`: range start; `null` for a file comment |
| `endLine` | `number \| null`, optional: inclusive range end |
| `lineContent` | `string \| null`: the raw diff line, with its `+`/`-`/space marker |
| `text` | `string`: markdown, may contain `suggestion` fences |
| `tag` | `"nit" \| "issue" \| "question" \| "praise"`, optional |
| `status` | `"open" \| "addressed" \| "resolved"`, optional |
| `replies` | `{ id, author: "agent" \| "reviewer", text, createdAt }[]`, optional |
| `resolved` | `boolean`, optional, legacy mirror of `status` |
| `createdAt` | ISO 8601 `string` |

| activity `type` | actor |
| --- | --- |
| `review_started` | system |
| `feedback_returned`, `review_approved`, `review_cancelled`, `comment_resolved`, `comment_reopened` | reviewer |
| `rereview_requested`, `comment_addressed` | agent |
| `comment_replied` | agent or reviewer |

## `get_scorecard`

| param | type | required | constraint |
| --- | --- | --- | --- |
| `reviewId` | `string` | yes | 1 to 200 chars |

Returns a `ReviewScorecard`, the same scorecard, order, noise and flags as the UI's `gc` panel. See [Review scorecard](/guides/review-scorecard/).

| field | type |
| --- | --- |
| `totals` | `{ files, additions, deletions, effectiveLines, noiseLines }` |
| `categories` | `{ id, label, band, summary, reasons[] }[]`; `id` is `size`, `tests`, `api`, `dependencies`, `hotspots` or `flags`; `band` is `low`, `medium` or `high` |
| `groups` | `{ id, label, files[] }[]` in suggested review order |
| `files` | `FileAnalysis[]` in suggested review order: `path`, `language`, `group`, `noise`, `whitespaceOnlyHunks`, `noiseLines`, `effectiveLines`, `testPair`, `isTest`, `churn`, `changedSinceReview`, `flags` |
| `moved` | `{ from: { file, start, end }, to: { file, start, end }, edited }[]` |

Flag `kind` values: `sensitive-path`, `public-api-removed`, `public-api-added`, `dependency`, `leftover`, `untested`, `hotspot`, `large`. Each flag has a `reason` and an optional `line`.

Real result, trimmed to two categories:

```json
{
  "totals": { "files": 1, "additions": 2, "deletions": 1, "effectiveLines": 3, "noiseLines": 0 },
  "categories": [
    { "id": "size", "label": "Size", "band": "low", "summary": "3 effective lines across 1 file", "reasons": ["retry.ts: 3 effective lines"] },
    { "id": "tests", "label": "Tests", "band": "medium", "summary": "1 changed code file without a test in the diff", "reasons": ["retry.ts: code change with no matching test in this diff"] }
  ],
  "groups": [{ "id": "(root)", "label": "(root)", "files": ["retry.ts"] }]
}
```

| error | cause |
| --- | --- |
| `scorecard is only available for diffs` | the review is a `browse` review |

## `reply_to_comment`

| param | type | required | constraint |
| --- | --- | --- | --- |
| `reviewId` | `string` | yes | 1 to 200 chars |
| `commentId` | `string` | yes | 1 to 200 chars |
| `text` | `string` | yes | 1 to 20,000 chars, markdown |

Returns `{ review }`. The reply is authored as `agent`. The reviewer sees it live in the thread.

## `mark_comment_addressed`

| param | type | required | constraint |
| --- | --- | --- | --- |
| `reviewId` | `string` | yes | 1 to 200 chars |
| `commentId` | `string` | yes | 1 to 200 chars |

Returns `{ review }`. Sets the comment's `status` to `addressed`, shown as an Addressed chip. Only the reviewer can resolve or reopen.

| error | cause |
| --- | --- |
| `resolved comments must be reopened by the reviewer` | the comment is already resolved |

## `request_rereview`

| param | type | required | constraint |
| --- | --- | --- | --- |
| `reviewId` | `string` | yes | 1 to 200 chars |
| `summary` | `string` | no | max 10,000 chars; shown to the reviewer as the agent update |

Returns `{ review }` with `status: "awaiting_human"`. Works on `feedback_ready` and on `approved` (it reopens the review).

| error | cause |
| --- | --- |
| `rereview requires returned feedback` | the review is still `awaiting_human` |
| `review record is terminal` | the review is cancelled |

## `cancel_review`

| param | type | required | constraint |
| --- | --- | --- | --- |
| `reviewId` | `string` | yes | 1 to 200 chars |
| `summary` | `string` | no | max 10,000 chars; stored as the record's `summary` |

Returns `{ review }` with `status: "cancelled"`. A second call on the same review fails with `review record is terminal`.

## Troubleshooting

If the `nittle` server doesn't show up in your agent, run `nittle doctor`. A stale `diffle-review` or `loupe-review` plugin keeps the old server wired in its place. After `nittle update`, reconnect the server (`/mcp` in Claude Code) or start a new agent session.
