---
title: HTTP API
description: The local HTTP routes the nittle review server exposes to its browser UI, with request and response types and status codes.
sidebar:
  order: 5
---

This is the local API the browser UI talks to. It is not a stable public contract: routes and shapes can change in any release. Agents should use the [MCP tools](/reference/mcp-tools/) or `nittle --wait --json` instead. Type names refer to `src/types.ts`.

## Server and request rules

| rule | value |
| --- | --- |
| bind address | `127.0.0.1` only, on the port `nittle` prints (random unless `-p, --port`) |
| `Host` header | must be `localhost`, `127.0.0.1` or `[::1]` on the server's port, else `403` `{"error":"host not allowed"}` |
| `Origin` header | when sent, must equal `http://<Host>`, else `403` `{"error":"origin mismatch"}` |
| response body | JSON, except `/api/raw` (file bytes), `/api/presence` (event stream) and static assets |
| error body | `ApiError`: `{ "error": string }`; the `/api/lsp/*` routes add fields (`LspErrorResponse`) |
| unknown route | `404` `{"error":"not found"}` |
| non-`/api/` GET | the built client (`/` serves `index.html`) |

The guard runs before routing, so `curl` works without an `Origin` header:

```sh
curl -s http://127.0.0.1:52144/api/lsp/status
```

```json
{"enabled":false,"languages":[]}
```

## Diff and review

| method | path | purpose | request | response | errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/diff` | the current diff; every call after the first re-runs `git diff` (live refresh) and keeps the last good diff if git fails | | `DiffResult` | |
| GET | `/api/comments` | comments for this session | | `ReviewRecord`, a legacy `ReviewFile`, or `{}` | |
| POST | `/api/comments` | replace the reviewer's comments | `CommentsUpdateRequest` | `ReviewRecord` (or `ReviewFile` without a record) | `400` `invalid json body`, `comments must be an array` |
| POST | `/api/viewed` | set the viewed file list | `ViewedUpdateRequest` | `ReviewRecord` (or `ReviewFile`) | `400` `invalid json body`, `viewed must be an array` |
| GET | `/api/compile?summary=` | the compiled review prompt; `summary` overrides the record's summary | | `CompilePromptResponse` | |
| GET | `/api/review?id=` | a Review Record; `id` defaults to this session's review | | `ReviewRecord` | `400` `id is required`, `404` `review record not found` |
| POST | `/api/review/outcome` | return feedback, approve or cancel | `ReviewOutcomeRequest` | `ReviewRecord` | `400` body errors, `409` transition errors |
| POST | `/api/review/reply` | reply as the reviewer | `CommentReplyRequest` | `ReviewRecord` | `400`, `409` |
| POST | `/api/review/status` | resolve or reopen a comment | `CommentStatusRequest` with `status` `resolved` or `open` | `ReviewRecord` | `400` `status must be resolved or open`, `409` |
| GET | `/api/review/legacy` | whether a legacy `.review` file exists | | `{ present: boolean }` | |
| POST | `/api/review/legacy` | import, remove or ignore it | `LegacyReviewRequest`; `import` needs `id`, `remove` needs `confirm: true` | `ReviewRecord`, `{ removed }` or `{ legacy, ignored: true }` | `400` `remove requires confirm=true`, `action must be import, remove, or ignore`; `409` |
| GET | `/api/interdiff?path=` | what changed in one file since the last returned feedback | | `InterdiffResponse` (`file: null` when unchanged) | `400` `path is required`, `path is not in the diff`; `404` `no previous review round`; `500` |
| GET | `/api/scorecard` | the deterministic scorecard | | `ReviewScorecard` | `404` `scorecard is only available for diffs`; `500` |

`409` messages on `/api/review/outcome`, `/reply` and `/status` come from the record: `review record is terminal`, `feedback requires a review awaiting the reviewer`, `returning feedback requires an unresolved comment or a summary`, `approval requires a review awaiting the reviewer`, `approval requires acknowledging unresolved comments`, `comment not found`. These routes read the review id from `id` (or `reviewId`) in the body.

Returning feedback also snapshots the new-side content of every diff file, which `/api/interdiff` compares against in the next round.

## Files, search and drafts

| method | path | purpose | request | response | errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/file?path=` | new-side text of a repo file, for the markdown preview | | `FileContentResponse` | `400` `invalid path`, `404` `file not found` |
| GET | `/api/raw?path=` | new-side bytes with a media content type (images, video a markdown file embeds) | | bytes | `400` `invalid path`, `404` `file not found` |
| GET | `/api/search?q=&regex=0\|1&case=smart\|sensitive\|insensitive` | search both sides of every text file in the diff | | `SearchResponse` | `400` `q is required`, `case must be smart, sensitive or insensitive`, bad regex; `422` search timed out; `429` too many searches at once; `500` |
| GET | `/api/drafts` | unsent comment drafts for this review | | `DraftsResponse` | |
| POST | `/api/drafts` | save or clear drafts; each update applies on its own | `DraftBatchRequest` (`text: ""` removes a draft) | `DraftsResponse` with `rejected` for refused drafts | `400` `body must set updates: up to 500 of { key, text }`; `413` `body too large` over 1 MiB |

`path` must be repo-relative, without `..`, and inside the repo. A working-tree symlink that points outside the repo answers `404`. Regex searches run in a worker that is killed when it runs over its time budget. `truncated: true` means a cap (result count, file size, line length or time) cut the search short.

## Session, state and updates

| method | path | purpose | request | response | errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/presence` | server-sent events stream that counts open tabs; `--wait` uses it to notice the last tab closing | | `text/event-stream`, a `: ping` every 5 s | |
| POST | `/api/session/stop` | stop this review server | `{ sessionId: string }` | `{ stopped: true }` | `400` `sessionId is required`, `403` `sessionId mismatch` |
| GET | `/api/state` | user state from `~/.nittle/state.json` | | `UserState` | |
| POST | `/api/state` | record the dismissed what's-new version | `StateUpdateRequest` | `UserState` | `400` `body must set seenVersion (string)` |
| GET | `/api/update` | installed version vs the newest release | | `UpdateStatus` | |

A CLI or hook-hosted server exits after `/api/session/stop`; under `--wait` the exit code is `4`. An MCP-hosted server only stops its HTTP server, since the agent's process keeps running.

## Code navigation: `/api/lsp/*`

| method | path | purpose | request | response |
| --- | --- | --- | --- | --- |
| GET | `/api/lsp/status` | state of the language server for each language in the diff; never starts a server | | `LspStatusResponse` |
| POST | `/api/lsp/definition` | go to definition or type definition | `LspDefinitionRequest` (`kind`: `definition` or `typeDefinition`) | `LspDefinitionResponse` |
| POST | `/api/lsp/hover` | hover docs | `LspPositionRequest`, optional `x-client-id` header | `LspHoverResponse` (`contents` is markdown, `""` when the server has nothing) |
| POST | `/api/lsp/references` | references grouped by file, diff files first, 2 lines of context each side | `LspPositionRequest` | `LspReferencesResponse` |
| GET | `/api/lsp/symbols?path=` | document outline as a tree; symbols on changed lines carry `changed: true` | | `LspDocumentSymbolsResponse` |
| GET | `/api/lsp/symbols?query=` | workspace symbols from every server for the diff's languages, merged | | `LspWorkspaceSymbolsResponse` |
| GET | `/api/lsp/file?uri=` | read-only text of a target outside the diff | | `LspFileResponse` |

### Request coordinates

| field | type | meaning |
| --- | --- | --- |
| `path` | `string` | repo-relative |
| `side` | `"old" \| "new"` | `old` needs a base commit; browse reviews have none |
| `line` | `number` | 1-based |
| `character` | `number` | 0-based JavaScript string (UTF-16) offset |

nittle converts to the position encoding the server negotiated (UTF-8, UTF-16 or UTF-32) and back when it can read the target's text, which it does for files up to 2 MiB. For any other target the server's character offsets pass through unchanged, which is exact only for UTF-16 servers.

### Status states

| `state` | meaning |
| --- | --- |
| `missing` | no server found on `PATH`; `hint` says how to install it |
| `idle` | installed, not started yet (servers start on the first navigation request) |
| `starting` | launched, finishing the initialize handshake |
| `indexing` | the server reports progress while it loads the project |
| `ready` | answering requests |
| `failed` | crashed twice (a crashed server is restarted once); `stderr` has the last output |

Under `--no-lsp` the status is `{ "enabled": false, "languages": [] }`. `limited: "dependencies unavailable"` means a detached worktree runs without your installed dependencies, and `blocker` says why a worktree could not move to the reviewed revision.

### Limits and timing

| limit | value |
| --- | --- |
| references | 200, with `total` and `truncated` |
| workspace symbols | 100, with `total` and `truncated` |
| text read for conversion and `/api/lsp/file` | 2 MiB |
| first request after a server starts | waits for its loading progress to end; goes ahead if no progress starts within 2 s; never waits more than 20 s |
| hover | a newer hover with the same `x-client-id`, or closing the connection, cancels the pending one |
| `/api/lsp/file` | only serves paths a navigation answer returned in this run |

Targets outside the repository (the standard library, `node_modules`, site-packages) come back with `inRepo: false` and `path: null`. `onDefinition: true` means the position is already on the declaration, and the UI lists references instead.

### LSP status codes

Errors carry `LspErrorResponse`: `{ error, code, state?, hint?, stderr? }`.

| status | `code` | when |
| --- | --- | --- |
| `200` | | every `/api/lsp/status` call |
| `400` | `invalid-request` | bad body or query, for example `line must be >= 1 and character >= 0`, `symbols needs ?path= or ?query=`, `uri must be a file: uri` |
| `403` | `forbidden` | `/api/lsp/file` for a path no navigation answer returned (`not a navigation target`) |
| `404` | `file-not-found` | the file can't be read, or a `/api/lsp/file` target is over 2 MiB |
| `409` | `server-unavailable` | no server can answer (missing, failed or disabled); `state` and sometimes `hint` say why |
| `409` | `old-side-unsupported` | the review has no base commit for an old-side request |
| `409` | `worktree-blocked` | the side's temp worktree has local changes and can't move to the reviewed revision |
| `409` | `stale` | the file changed under the request twice; retry |
| `499` | `cancelled` | superseded or aborted |
| `502` | `request-failed` | the language server answered with an error or timed out |
